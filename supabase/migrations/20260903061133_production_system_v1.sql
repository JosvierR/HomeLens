-- HomeLens Production System V1
-- Normalized persistence, RLS ownership, learning evidence, capture policy.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  status text not null default 'active'
    check (status in ('active', 'archived', 'deleted')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index projects_user_id_created_at_idx on public.projects (user_id, created_at desc);
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  room_type text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index rooms_user_id_idx on public.rooms (user_id);
create index rooms_project_id_idx on public.rooms (project_id);
create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'capturing', 'analyzing', 'needs_verification', 'stable', 'completed', 'failed')),
  capture_mode text not null default 'camera'
    check (capture_mode in ('camera', 'demo', 'upload')),
  started_at timestamptz,
  completed_at timestamptz,
  measurement_model_version text not null default 'geometry-v1',
  decision_model_version text not null default 'decision-v1',
  capture_policy_version text not null default 'capture-policy-v1',
  calibration_version text not null default 'calibration-v1',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index scans_user_id_created_at_idx on public.scans (user_id, created_at desc);
create index scans_room_id_idx on public.scans (room_id);
create trigger scans_set_updated_at
before update on public.scans
for each row execute function public.set_updated_at();

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_id uuid not null references public.scans (id) on delete cascade,
  measurement_key text not null check (char_length(trim(measurement_key)) between 1 and 80),
  label text not null,
  accepted_value double precision not null check (accepted_value > 0),
  unit text not null default 'ft' check (unit in ('ft')),
  source text not null check (source in ('estimated', 'manual', 'imported')),
  original_estimate double precision not null check (original_estimate > 0),
  raw_confidence double precision not null check (raw_confidence >= 0 and raw_confidence <= 1),
  calibrated_confidence double precision
    check (calibrated_confidence is null or (calibrated_confidence >= 0 and calibrated_confidence <= 1)),
  verified_at timestamptz,
  verification_source text check (verification_source is null or verification_source in ('manual')),
  model_version text not null default 'geometry-v1',
  revision int not null default 1 check (revision >= 1),
  idempotency_key text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (scan_id, measurement_key),
  unique (scan_id, idempotency_key)
);

create index measurements_user_id_idx on public.measurements (user_id);
create index measurements_scan_id_idx on public.measurements (scan_id);
create trigger measurements_set_updated_at
before update on public.measurements
for each row execute function public.set_updated_at();

create table public.measurement_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measurement_id uuid not null references public.measurements (id) on delete cascade,
  scan_id uuid not null references public.scans (id) on delete cascade,
  previous_value double precision not null check (previous_value > 0),
  new_value double precision not null check (new_value > 0),
  previous_source text not null,
  new_source text not null,
  reason text,
  verified_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index measurement_revisions_measurement_id_idx on public.measurement_revisions (measurement_id);
create index measurement_revisions_scan_id_idx on public.measurement_revisions (scan_id);

create table public.analysis_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_id uuid not null references public.scans (id) on delete cascade,
  decision_model_version text not null,
  planning_index double precision,
  baseline_band text,
  band_stability double precision check (band_stability is null or (band_stability >= 0 and band_stability <= 1)),
  distribution jsonb not null default '{}'::jsonb,
  recommended_action_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create index analysis_snapshots_scan_id_created_at_idx on public.analysis_snapshots (scan_id, created_at desc);
create index analysis_snapshots_user_id_idx on public.analysis_snapshots (user_id);

create table public.capture_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_id uuid not null references public.scans (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  target_type text not null,
  storage_path text not null,
  status text not null default 'uploading'
    check (status in ('uploading', 'ready', 'rejected', 'deleted')),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/webp', 'image/png')),
  width_px int not null check (width_px > 0),
  height_px int not null check (height_px > 0),
  byte_size int not null check (byte_size > 0 and byte_size <= 8 * 1024 * 1024),
  sharpness_score double precision,
  brightness_score double precision,
  quality_bucket text check (quality_bucket is null or quality_bucket in ('good', 'usable', 'recapture_recommended')),
  capture_method text not null default 'camera',
  device_family text,
  accepted boolean not null default false,
  rejection_reason text,
  model_version text not null default 'geometry-v1',
  evidence_origin text not null default 'real_user_verification'
    check (evidence_origin in ('synthetic_demo', 'real_user_verification', 'internal_test')),
  captured_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, storage_path)
);

create index capture_evidence_scan_id_idx on public.capture_evidence (scan_id);
create index capture_evidence_user_id_created_at_idx on public.capture_evidence (user_id, created_at desc);

create table public.capture_evidence_measurements (
  capture_evidence_id uuid not null references public.capture_evidence (id) on delete cascade,
  measurement_id uuid not null references public.measurements (id) on delete cascade,
  relationship_type text not null default 'supports'
    check (relationship_type in ('supports', 'primary', 'context')),
  primary key (capture_evidence_id, measurement_id, relationship_type)
);

create table public.verification_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_id uuid not null references public.scans (id) on delete cascade,
  measurement_id uuid not null references public.measurements (id) on delete cascade,
  measurement_type text not null,
  estimated_value double precision not null check (estimated_value > 0),
  verified_value double precision not null check (verified_value > 0),
  absolute_error double precision not null check (absolute_error >= 0),
  relative_error double precision not null check (relative_error >= 0),
  raw_confidence double precision not null check (raw_confidence >= 0 and raw_confidence <= 1),
  calibrated_confidence double precision
    check (calibrated_confidence is null or (calibrated_confidence >= 0 and calibrated_confidence <= 1)),
  tolerance_used double precision not null check (tolerance_used > 0),
  within_tolerance boolean not null,
  decision_stability_before double precision not null check (decision_stability_before >= 0 and decision_stability_before <= 1),
  decision_stability_after double precision not null check (decision_stability_after >= 0 and decision_stability_after <= 1),
  stability_gain double precision not null check (stability_gain >= -1 and stability_gain <= 1),
  capture_method text,
  capture_target text,
  device_family text,
  quality_bucket text,
  measurement_model_version text not null,
  decision_model_version text not null,
  calibration_version text not null,
  evidence_origin text not null default 'real_user_verification'
    check (evidence_origin in ('synthetic_demo', 'real_user_verification', 'internal_test')),
  idempotency_key text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, idempotency_key)
);

create index verification_evidence_measurement_type_model_idx
  on public.verification_evidence (measurement_type, measurement_model_version);
create index verification_evidence_type_target_model_idx
  on public.verification_evidence (measurement_type, capture_target, measurement_model_version);
create index verification_evidence_user_id_created_at_idx
  on public.verification_evidence (user_id, created_at desc);
create index verification_evidence_scan_id_idx on public.verification_evidence (scan_id);

create table public.capture_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_id uuid not null references public.scans (id) on delete cascade,
  target_type text not null,
  related_measurement_id uuid references public.measurements (id) on delete set null,
  instruction text not null,
  reason text not null,
  stability_before double precision not null check (stability_before >= 0 and stability_before <= 1),
  projected_stability_after double precision not null check (projected_stability_after >= 0 and projected_stability_after <= 1),
  projected_gain double precision not null,
  estimated_effort double precision not null check (estimated_effort > 0),
  historical_reliability double precision
    check (historical_reliability is null or (historical_reliability >= 0 and historical_reliability <= 1)),
  utility_score double precision not null,
  policy_version text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index capture_actions_scan_id_idx on public.capture_actions (scan_id);
create index capture_actions_user_id_idx on public.capture_actions (user_id);

alter table public.analysis_snapshots
  add constraint analysis_snapshots_recommended_action_fk
  foreign key (recommended_action_id) references public.capture_actions (id) on delete set null;

create table public.capture_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  capture_action_id uuid not null references public.capture_actions (id) on delete cascade,
  capture_evidence_id uuid references public.capture_evidence (id) on delete set null,
  completed boolean not null default false,
  stability_before double precision not null check (stability_before >= 0 and stability_before <= 1),
  stability_after double precision check (stability_after is null or (stability_after >= 0 and stability_after <= 1)),
  actual_gain double precision,
  human_verification_needed_after boolean,
  elapsed_ms int check (elapsed_ms is null or elapsed_ms >= 0),
  idempotency_key text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, idempotency_key)
);

create index capture_outcomes_action_id_idx on public.capture_outcomes (capture_action_id);

create table public.calibration_profiles (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('global', 'measurement_type', 'capture_context')),
  measurement_type text,
  capture_target text,
  device_family text,
  quality_bucket text,
  model_version text not null,
  sample_count int not null default 0 check (sample_count >= 0),
  success_count int not null default 0 check (success_count >= 0),
  mean_raw_confidence double precision,
  observed_success_rate double precision,
  mean_absolute_error double precision,
  mean_relative_error double precision,
  calibration_gap double precision,
  posterior_confidence double precision,
  evidence_origin text not null default 'real_user_verification'
    check (evidence_origin in ('synthetic_demo', 'real_user_verification', 'internal_test')),
  updated_at timestamptz not null default timezone('utc', now()),
  unique nulls not distinct (scope_type, measurement_type, capture_target, device_family, quality_bucket, model_version, evidence_origin)
);

create index calibration_profiles_lookup_idx
  on public.calibration_profiles (measurement_type, capture_target, model_version, evidence_origin);

create table public.capture_policy_profiles (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  measurement_type text,
  context_key text,
  policy_version text not null,
  sample_count int not null default 0 check (sample_count >= 0),
  completion_rate double precision,
  mean_projected_gain double precision,
  mean_actual_gain double precision,
  success_rate double precision,
  mean_effort_ms double precision,
  reliability_score double precision,
  updated_at timestamptz not null default timezone('utc', now()),
  unique nulls not distinct (target_type, measurement_type, context_key, policy_version)
);

create index capture_policy_profiles_lookup_idx
  on public.capture_policy_profiles (target_type, measurement_type, policy_version);

create table public.learning_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  input_from timestamptz,
  input_to timestamptz,
  profile_version text,
  error_message text,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz
);

-- Ownership helper: prevent inserting/updating another user's user_id.
create or replace function public.enforce_user_id()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'user_id must equal auth.uid()';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id is immutable';
    end if;
    if old.user_id is distinct from auth.uid() then
      raise exception 'cannot update another user''s row';
    end if;
  end if;
  return new;
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'projects', 'rooms', 'scans', 'measurements', 'measurement_revisions',
    'analysis_snapshots', 'capture_evidence', 'verification_evidence',
    'capture_actions', 'capture_outcomes'
  ]
  loop
    execute format(
      'create trigger %I_enforce_user_id before insert or update on public.%I
       for each row execute function public.enforce_user_id()',
      tbl, tbl
    );
  end loop;
end;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.rooms enable row level security;
alter table public.scans enable row level security;
alter table public.measurements enable row level security;
alter table public.measurement_revisions enable row level security;
alter table public.analysis_snapshots enable row level security;
alter table public.capture_evidence enable row level security;
alter table public.capture_evidence_measurements enable row level security;
alter table public.verification_evidence enable row level security;
alter table public.capture_actions enable row level security;
alter table public.capture_outcomes enable row level security;
alter table public.calibration_profiles enable row level security;
alter table public.capture_policy_profiles enable row level security;
alter table public.learning_job_runs enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy profiles_update_own on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy projects_select_own on public.projects
  for select to authenticated using (auth.uid() = user_id);
create policy projects_insert_own on public.projects
  for insert to authenticated with check (auth.uid() = user_id);
create policy projects_update_own on public.projects
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy projects_delete_own on public.projects
  for delete to authenticated using (auth.uid() = user_id);

create policy rooms_select_own on public.rooms
  for select to authenticated using (auth.uid() = user_id);
create policy rooms_insert_own on public.rooms
  for insert to authenticated with check (auth.uid() = user_id);
create policy rooms_update_own on public.rooms
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy rooms_delete_own on public.rooms
  for delete to authenticated using (auth.uid() = user_id);

create policy scans_select_own on public.scans
  for select to authenticated using (auth.uid() = user_id);
create policy scans_insert_own on public.scans
  for insert to authenticated with check (auth.uid() = user_id);
create policy scans_update_own on public.scans
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy scans_delete_own on public.scans
  for delete to authenticated using (auth.uid() = user_id);

create policy measurements_select_own on public.measurements
  for select to authenticated using (auth.uid() = user_id);
create policy measurements_insert_own on public.measurements
  for insert to authenticated with check (auth.uid() = user_id);
create policy measurements_update_own on public.measurements
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy measurements_delete_own on public.measurements
  for delete to authenticated using (auth.uid() = user_id);

create policy measurement_revisions_select_own on public.measurement_revisions
  for select to authenticated using (auth.uid() = user_id);
create policy measurement_revisions_insert_own on public.measurement_revisions
  for insert to authenticated with check (auth.uid() = user_id);

create policy analysis_snapshots_select_own on public.analysis_snapshots
  for select to authenticated using (auth.uid() = user_id);
create policy analysis_snapshots_insert_own on public.analysis_snapshots
  for insert to authenticated with check (auth.uid() = user_id);

create policy capture_evidence_select_own on public.capture_evidence
  for select to authenticated using (auth.uid() = user_id);
create policy capture_evidence_insert_own on public.capture_evidence
  for insert to authenticated with check (auth.uid() = user_id);
create policy capture_evidence_update_own on public.capture_evidence
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy capture_evidence_delete_own on public.capture_evidence
  for delete to authenticated using (auth.uid() = user_id);

create policy capture_evidence_measurements_select_own on public.capture_evidence_measurements
  for select to authenticated
  using (
    exists (
      select 1 from public.capture_evidence ce
      where ce.id = capture_evidence_id and ce.user_id = auth.uid()
    )
  );
create policy capture_evidence_measurements_insert_own on public.capture_evidence_measurements
  for insert to authenticated
  with check (
    exists (
      select 1 from public.capture_evidence ce
      where ce.id = capture_evidence_id and ce.user_id = auth.uid()
    )
    and exists (
      select 1 from public.measurements m
      where m.id = measurement_id and m.user_id = auth.uid()
    )
  );
create policy capture_evidence_measurements_delete_own on public.capture_evidence_measurements
  for delete to authenticated
  using (
    exists (
      select 1 from public.capture_evidence ce
      where ce.id = capture_evidence_id and ce.user_id = auth.uid()
    )
  );

create policy verification_evidence_select_own on public.verification_evidence
  for select to authenticated using (auth.uid() = user_id);
create policy verification_evidence_insert_own on public.verification_evidence
  for insert to authenticated with check (auth.uid() = user_id);

-- Aggregate profiles: authenticated users may read real aggregates only (no synthetic mix-in).
create policy calibration_profiles_select_authenticated on public.calibration_profiles
  for select to authenticated using (evidence_origin = 'real_user_verification');
create policy capture_policy_profiles_select_authenticated on public.capture_policy_profiles
  for select to authenticated using (true);

create policy capture_actions_select_own on public.capture_actions
  for select to authenticated using (auth.uid() = user_id);
create policy capture_actions_insert_own on public.capture_actions
  for insert to authenticated with check (auth.uid() = user_id);

create policy capture_outcomes_select_own on public.capture_outcomes
  for select to authenticated using (auth.uid() = user_id);
create policy capture_outcomes_insert_own on public.capture_outcomes
  for insert to authenticated with check (auth.uid() = user_id);

-- learning_job_runs: no policies for authenticated/anon (service role only via bypass).
revoke all on public.learning_job_runs from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.calibration_profiles to authenticated;
grant select on public.capture_policy_profiles to authenticated;
revoke all on public.learning_job_runs from authenticated;
