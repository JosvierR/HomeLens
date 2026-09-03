-- Photo-to-metric inference persistence. Raw depth arrays are intentionally
-- excluded from Postgres; workers return only scalar metadata and observations.

alter table public.capture_evidence
  add column capture_id text,
  add column orientation text check (orientation is null or orientation in ('portrait', 'landscape', 'square')),
  add column camera_id_hash text,
  add column facing_mode text,
  add column focal_length_35mm double precision check (focal_length_35mm is null or focal_length_35mm > 0),
  add column estimated_focal_length_px double precision check (estimated_focal_length_px is null or estimated_focal_length_px > 0),
  add column contrast_score double precision check (contrast_score is null or contrast_score between 0 and 1),
  add column shadow_clipping double precision check (shadow_clipping is null or shadow_clipping between 0 and 1),
  add column highlight_clipping double precision check (highlight_clipping is null or highlight_clipping between 0 and 1);

create unique index capture_evidence_capture_id_idx
  on public.capture_evidence (user_id, capture_id)
  where capture_id is not null;

alter table public.scans drop constraint if exists scans_status_check;
alter table public.scans
  add constraint scans_status_check check (status in (
    'draft', 'capturing', 'captured', 'analyzing', 'processing_geometry',
    'estimated', 'needs_more_evidence', 'ready_for_analysis',
    'needs_verification', 'stable', 'completed', 'failed'
  )),
  add column inference_job_id uuid,
  add column geometry_shape text check (geometry_shape is null or geometry_shape in ('rectangular', 'near_rectangular', 'irregular', 'unknown')),
  add column rectangularity_confidence double precision check (rectangularity_confidence is null or rectangularity_confidence between 0 and 1),
  add column inference_error_code text,
  add column inference_error_message text,
  add column estimated_at timestamptz;

alter table public.measurements
  add column measurement_method text check (measurement_method is null or measurement_method in ('photo_metric_depth', 'manual', 'simulated_demo')),
  add column depth_model_version text,
  add column structure_model_version text,
  add column geometry_model_version text,
  add column confidence_model_version text,
  add column supporting_view_count int check (supporting_view_count is null or supporting_view_count between 0 and 20),
  add column raw_geometry_confidence double precision check (raw_geometry_confidence is null or raw_geometry_confidence between 0 and 1),
  add column multi_view_consistency double precision check (multi_view_consistency is null or multi_view_consistency between 0 and 1),
  add column uncertainty_low double precision check (uncertainty_low is null or uncertainty_low > 0),
  add column uncertainty_high double precision check (uncertainty_high is null or uncertainty_high > 0),
  add constraint measurements_uncertainty_order check (
    uncertainty_low is null
    or uncertainty_high is null
    or uncertainty_low <= uncertainty_high
  );

alter table public.verification_evidence
  add column depth_confidence double precision check (depth_confidence is null or depth_confidence between 0 and 1),
  add column plane_fit_residual double precision check (plane_fit_residual is null or plane_fit_residual >= 0),
  add column supporting_view_count int check (supporting_view_count is null or supporting_view_count between 0 and 20),
  add column multi_view_disagreement double precision check (multi_view_disagreement is null or multi_view_disagreement >= 0),
  add column image_quality double precision check (image_quality is null or image_quality between 0 and 1),
  add column capture_targets text[],
  add column depth_model_version text,
  add column structure_model_version text,
  add column geometry_model_version text,
  add column confidence_model_version text;

create table public.image_inference_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_id uuid not null references public.scans (id) on delete cascade,
  capture_evidence_id uuid not null references public.capture_evidence (id) on delete cascade,
  provider_job_id uuid not null,
  depth_model text not null,
  depth_model_version text not null,
  structure_model text not null,
  structure_model_version text not null,
  geometry_model_version text not null,
  status text not null check (status in ('queued', 'processing', 'succeeded', 'partial', 'insufficient', 'failed')),
  processing_time_ms int check (processing_time_ms is null or processing_time_ms >= 0),
  estimated_focal_length_px double precision check (estimated_focal_length_px is null or estimated_focal_length_px > 0),
  min_depth_meters double precision check (min_depth_meters is null or min_depth_meters > 0),
  max_depth_meters double precision check (max_depth_meters is null or max_depth_meters > 0),
  depth_quality double precision check (depth_quality is null or depth_quality between 0 and 1),
  structure_quality double precision check (structure_quality is null or structure_quality between 0 and 1),
  rectangularity_confidence double precision check (rectangularity_confidence is null or rectangularity_confidence between 0 and 1),
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (provider_job_id, capture_evidence_id)
);

create index image_inference_runs_scan_id_idx on public.image_inference_runs (scan_id, created_at desc);
create index image_inference_runs_user_id_idx on public.image_inference_runs (user_id, created_at desc);
create index image_inference_runs_provider_job_id_idx on public.image_inference_runs (provider_job_id);

create table public.measurement_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_id uuid not null references public.scans (id) on delete cascade,
  measurement_id uuid references public.measurements (id) on delete cascade,
  capture_evidence_id uuid not null references public.capture_evidence (id) on delete cascade,
  measurement_type text not null check (measurement_type in ('width', 'length', 'height')),
  estimated_value double precision not null check (estimated_value > 0),
  confidence double precision not null check (confidence between 0 and 1),
  uncertainty_low double precision not null check (uncertainty_low > 0),
  uncertainty_high double precision not null check (uncertainty_high > 0),
  geometry_fit_error double precision not null check (geometry_fit_error >= 0),
  depth_quality double precision not null check (depth_quality between 0 and 1),
  structural_confidence double precision not null check (structural_confidence between 0 and 1),
  geometry_fit_quality double precision not null check (geometry_fit_quality between 0 and 1),
  image_quality double precision not null check (image_quality between 0 and 1),
  distance_quality double precision not null check (distance_quality between 0 and 1),
  occlusion_quality double precision not null check (occlusion_quality between 0 and 1),
  geometry_completeness double precision not null check (geometry_completeness between 0 and 1),
  model_version text not null,
  created_at timestamptz not null default timezone('utc', now()),
  check (uncertainty_low <= estimated_value and uncertainty_high >= estimated_value),
  unique (scan_id, capture_evidence_id, measurement_type, model_version)
);

create index measurement_observations_scan_type_idx
  on public.measurement_observations (scan_id, measurement_type);
create index measurement_observations_measurement_id_idx
  on public.measurement_observations (measurement_id);
create index measurement_observations_user_id_idx
  on public.measurement_observations (user_id, created_at desc);

alter table public.image_inference_runs enable row level security;
alter table public.measurement_observations enable row level security;

create policy image_inference_runs_select_own on public.image_inference_runs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy image_inference_runs_insert_own on public.image_inference_runs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy image_inference_runs_update_own on public.image_inference_runs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy image_inference_runs_delete_own on public.image_inference_runs
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy measurement_observations_select_own on public.measurement_observations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy measurement_observations_insert_own on public.measurement_observations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy measurement_observations_update_own on public.measurement_observations
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy measurement_observations_delete_own on public.measurement_observations
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger image_inference_runs_enforce_user_id
before insert or update on public.image_inference_runs
for each row execute function public.enforce_user_id();

create trigger measurement_observations_enforce_user_id
before insert or update on public.measurement_observations
for each row execute function public.enforce_user_id();

grant select, insert, update, delete on public.image_inference_runs to authenticated;
grant select, insert, update, delete on public.measurement_observations to authenticated;

-- Trusted server callbacks use the service role and still provide an explicit
-- user_id. Browser roles continue to be checked against auth.uid().
create or replace function public.enforce_user_id()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.user_id is distinct from (select auth.uid()) then
      raise exception 'user_id must equal auth.uid()';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id is immutable';
    end if;
    if old.user_id is distinct from (select auth.uid()) then
      raise exception 'cannot update another user''s row';
    end if;
  end if;
  return new;
end;
$$;
