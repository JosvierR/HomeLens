# Security and Privacy

HomeLens is an experimental prototype. It must not be used for safety-critical decisions or certified HVAC sizing.

## Current data handling

- Demo capture can use the real browser camera for guided frames, or a local demo fallback.
- Demo mode does not permanently store imagery.
- Authenticated product mode stores private frames in Supabase Storage (`scan-evidence`) under `{user_id}/...`.
- Frames are canvas-normalized (EXIF stripped, resized) before upload.
- Microphone access is never requested.
- Seed/demo calibration evidence is synthetic and isolated from production learning (`synthetic_demo`).
- API error responses contain stable codes and validation paths, not internal stack traces.
- Analytics properties are allowlisted. Room names, scan IDs, addresses, dimensions, images, notes, user identity, and device identifiers are discarded by the analytics abstraction.
- Public runtime configuration may include only the Supabase URL + publishable key. Secret keys stay server-only.

## Input and API controls

All scan and verification payloads are validated server-side. The contracts reject non-finite or non-positive dimensions, values above the prototype maximum of 100 feet, confidence outside `0..1`, unknown units or sources, duplicate IDs, missing required dimensions, malformed JSON, and unexpected fields.

Authenticated product APIs additionally require a verified Supabase session and enforce row ownership (`auth.uid() = user_id`) in Postgres RLS.

## Production persistence checklist

- [x] Authentication (magic link / OTP)
- [x] Row Level Security on user-owned tables
- [x] Private Storage bucket + path-scoped policies
- [x] Publishable key only in browser bundles
- [ ] Linked remote Supabase project + applied migrations in production
- [ ] Multi-user isolation proven against live project
- [ ] Account deletion secret configured in Vercel
- [ ] Evidence retention policy operations validated in production

Never commit credentials. Local values belong in `.env`; only non-secret public configuration may be exposed through Nuxt runtime config.
