# ADR 001: Treat decision confidence as a first-class domain concept

## Status
Accepted

## Context
Physical-world measurements are uncertain. A raw confidence score does not tell a product team whether uncertainty can change a downstream decision.

## Decision
HomeLens will keep confidence and provenance attached to every measurement, propagate that uncertainty through deterministic scenarios, and calculate decision stability separately from measurement confidence.

Human verification is prioritized by projected improvement in decision stability, not by lowest confidence alone.

## Consequences

- downstream features receive both values and uncertainty metadata
- human review becomes adaptive rather than checklist-driven
- model estimates and human-verified values remain distinguishable
- tests can assert deterministic decision behavior
- future calibrated distributions can replace the current transparent heuristic without changing the UI contract
