-- Persist the non-dimensional inputs used by the decision engine so a
-- completed camera scan can be reconstructed after a refresh.

alter table public.scans
  add column windows_count int not null default 0
    check (windows_count between 0 and 100),
  add column doors_count int not null default 0
    check (doors_count between 0 and 100),
  add column accepted_frame_count int not null default 0
    check (accepted_frame_count between 0 and 20),
  add column device_family text;
