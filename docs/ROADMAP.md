# Build Roadmap

## Milestone 0 — Vertical slice ✅

- scan setup
- sample room model
- editable measurements
- confidence + provenance
- server-side decision-confidence API
- decision stability
- verification priority
- tests + CI

## Milestone 1 — Scan Rescue

Goal: ask for the smallest amount of additional human input needed to stabilize a decision.

- define instability threshold
- select highest-value verification
- generate a single next action
- recompute after correction
- stop requesting input once stable
- instrument rescue funnel

## Milestone 2 — Persistence

- projects
- rooms
- scan revisions
- measurements
- provenance history
- decision snapshots
- reviewer actions

## Milestone 3 — Reviewer workspace

- approve measurement
- correct measurement
- request recapture
- attach reviewer note
- compare model vs human values
- audit trail

## Milestone 4 — Whole-home dependency graph

- room relationships
- shared assumptions
- equipment constraints
- electrical constraints
- invalidation graph after edits

## Milestone 5 — Native capture

- SwiftUI shell
- ARKit room measurement proof of concept
- shared API contract
- device capability metadata
- confidence calibration hooks

## Milestone 6 — Production quality

- e2e tests
- error monitoring
- analytics dashboard
- rate limits
- auth + RBAC
- accessibility pass
- demo deployment
