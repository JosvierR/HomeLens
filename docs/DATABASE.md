# Database

HomeLens persists real product state in Supabase Postgres with Row Level Security.

## Entities

```mermaid
erDiagram
  profiles ||--o{ projects : owns
  projects ||--o{ rooms : contains
  rooms ||--o{ scans : contains
  scans ||--o{ measurements : has
  measurements ||--o{ measurement_revisions : history
  scans ||--o{ analysis_snapshots : snapshots
  scans ||--o{ capture_evidence : frames
  capture_evidence }o--o{ measurements : supports
  scans ||--o{ verification_evidence : ground_truth
  scans ||--o{ capture_actions : recommendations
  capture_actions ||--o{ capture_outcomes : results
  calibration_profiles ||--|| verification_evidence : aggregates
  capture_policy_profiles ||--|| capture_outcomes : aggregates
```

## Ownership

Every user-owned table includes `user_id`.
Policies require `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE.
A trigger rejects inserts/updates that spoof another `user_id`.

## Storage

Private bucket: `scan-evidence`

Path:

`{user_id}/{project_id}/{scan_id}/{capture_evidence_id}.{ext}`

Storage RLS allows authenticated users only under their own `user_id` prefix.

Upload mode (v1): authenticated direct upload via `@supabase/supabase-js` under RLS.
Signed read URLs are generated on demand and never stored.

## Evidence origin

`evidence_origin` isolates:

- `synthetic_demo` — demo seed / local in-memory only
- `real_user_verification` — production learning default
- `internal_test` — CI / local integration

Production calibration defaults to `real_user_verification`.

## Model versions

Rows persist:

- `measurement_model_version`
- `decision_model_version`
- `calibration_version`
- `capture_policy_version`

Pinned in `shared/model-versions.ts`.

## Migrations

```powershell
npx supabase migration new <name>
npx supabase db reset   # local, requires Docker Desktop
npx supabase db push    # linked remote project
```

## Retention / deletion

Deleting a project removes Storage objects for that project, then cascades DB rows.
Account deletion must remove auth user + owned data (server-only privileged path).

## Indexes

Created for real access paths: `(user_id, created_at)`, `scan_id`, measurement type + model version, capture action ids.
