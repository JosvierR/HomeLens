# Security and Privacy

HomeLens is an experimental prototype. It must not be used for safety-critical decisions or certified HVAC sizing.

## Current data handling

- The capture experience is simulated; no camera frames, photographs, or room imagery are collected.
- The demo contains no address, user identity, account, or real device identifier.
- Evidence is held in process memory and is lost when the server restarts.
- Seed evidence is synthetic and marked with `demo: true`.
- API error responses contain stable codes and validation paths, not internal stack traces.
- Analytics properties are allowlisted. Room names, scan IDs, addresses, dimensions, images, notes, user identity, and device identifiers are discarded by the analytics abstraction.
- No analytics vendor receives data in the current build.
- Public runtime configuration contains no credential or server secret.

## Input and API controls

All scan and verification payloads are validated server-side. The contracts reject non-finite or non-positive dimensions, values above the prototype maximum of 100 feet, confidence outside `0..1`, unknown units or sources, duplicate IDs, missing required dimensions, malformed JSON, and unexpected fields.

## Before production persistence

A production deployment must add:

- authentication, authorization, tenant isolation, and row-level access controls;
- encryption in transit and at rest;
- explicit consent for capture and calibration use;
- evidence retention, deletion, export, and purpose-limitation policies;
- separation of calibration features from directly identifying data;
- aggregation or k-anonymity thresholds before contextual segments are exposed;
- rate limiting, request-size limits, audit logs, abuse monitoring, and incident response;
- controls preventing raw imagery or precise household geometry from entering analytics or application logs;
- model/evidence versioning and rollback procedures;
- secrets stored only in server-side environment or managed secret storage.

Never commit credentials. Local values belong in `.env`; only non-secret public configuration may be exposed through Nuxt runtime config.
