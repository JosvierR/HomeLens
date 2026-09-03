# Privacy Architecture

## What is captured

- Selected camera **frames** only (not continuous video)
- Never microphone / audio
- Local canvas redraw strips EXIF/GPS before upload
- Longest edge resized (~1600–1920 px)

## What is uploaded (authenticated product mode)

- Private Storage objects under `{user_id}/...`
- Capture metadata rows (`capture_evidence`)
- Measurements, revisions, verification evidence, analysis snapshots

## What is not uploaded (demo mode)

- Demo remains local / synthetic
- No permanent Storage writes for Try demo

## Access control

- Publishable key only in the browser (`NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- Secret key server-only (`SUPABASE_SECRET_KEY`) — never `NUXT_PUBLIC_*`
- RLS ownership: `auth.uid() = user_id`
- Private bucket `scan-evidence`
- Signed read URLs are short-lived and not persisted
- The GPU worker receives a five-minute signed URL over its authenticated job API
- Callback payloads are HMAC authenticated; signed URLs never appear in callbacks or database rows
- Source images and raw depth arrays are processed in memory and discarded by the worker after each job

## Learning minimization

- Calibration/Error Atlas surfaces show aggregates + sample counts
- No raw imagery in analytics
- PostHog optional and allowlisted (no images, emails, tokens, precise addresses)

## Deletion

- Project delete: Storage objects then cascading DB delete
- Future account deletion: remove auth user + owned evidence from learning datasets and refresh aggregates

## Disclaimers

HomeLens is not certified HVAC / Manual J software and does not invent certified room dimensions from arbitrary frames.
