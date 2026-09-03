# Learning System

HomeLens learning is transparent statistics over verified measurements and capture outcomes.
It is not a black-box vision model.

## Loop

```text
estimate + raw confidence
  → decision stability
  → Next Best Capture (or stop)
  → useful frame / verification
  → observed error + stability gain
  → verification_evidence
  → calibration_profiles / capture_policy_profiles
  ↺
```

## Raw vs calibrated confidence

- `rawConfidence` is immutable model output.
- `calibratedConfidence` is a separate presentation/decision override.
- Verification never overwrites `original_estimate` or `raw_confidence`.

## Success definition

Prototype tolerance (not certified):

`relative error <= 0.03`

Stored on every verification row as `tolerance_used`.

## Calibration smoothing

`shared/calibration.ts` buckets predicted confidence and compares to observed success.
Suggestion fallback hierarchy:

1. exact compatible context
2. measurement type
3. global
4. raw confidence

Production sample thresholds (config):

| Scope | Minimum samples |
|---|---|
| exact context | 25 |
| measurement type | 20 |
| global | 30 |

Below threshold → raw fallback.

## Error Atlas

Service: `server/services/error-atlas.ts`

Built from:

- `verification_evidence`
- `calibration_profiles`
- `capture_actions` / `capture_outcomes`

Exposes explainable aggregate text only. Never other users' images.

## Next Best Capture

Pure module: `shared/next-best-capture.ts`

```text
utility ≈ (expectedDecisionStabilityGain × actionReliability) / effortCost
```

STOP when:

- stability already meets target
- projected gain negligible
- evidence sufficient
- remaining utility poor
- no supported action

## Capture policy learning

`capture_outcomes` records whether a recommended capture completed and the actual stability gain.
`capture_policy_profiles` aggregates reliability for future ranking.

## Synthetic isolation

Demo evidence (`demo: true` / `synthetic_demo`) must not train production profiles.

## Limitations

- Tolerances and thresholds are product prototypes, not scientific standards.
- Human verification is imperfect ground truth.
- Camera frames are evidence, not validated dimension extractors.
- Profile refresh jobs need a configured secret key / scheduler in production.
