# Decision, Rescue, and Calibration Logic

## Public conventions

- Measurement confidence and decision stability are fractions in the inclusive range `0..1`.
- UI percentages are formatting only.
- Dimensions use feet and must be finite, greater than zero, and no greater than the prototype limit of 100 feet.
- Identical input, sample count, and calibration overrides produce identical output.

## Illustrative planning model

```text
area = width * length
volumeFactor = max(0.75, height / 8)
planningIndex = area * volumeFactor + windows * 12 + doors * 8
```

Bands are `compact < 320`, `standard < 420`, and `high-capacity >= 420`. This is not an HVAC sizing formula.

## Scenario uncertainty

```text
uncertaintyFraction = (1 - effectiveConfidence) * 0.29
sampledValue = acceptedValue * (1 + deterministicNoise * uncertaintyFraction)
```

Human-verified confidence `1` has zero spread. `bandStability` is the share of deterministic scenarios remaining in the baseline band.

## Verification priority

For each unresolved measurement:

```text
impactPercent = abs(highScenarioIndex - lowScenarioIndex) / baselineIndex
priorityScore = impactPercent * (1 - effectiveConfidence) * 100
```

The impact term comes from the downstream model. Therefore a 75%-reliable input with high sensitivity can outrank a 50%-reliable input with no downstream effect.

## Scan Rescue

Scan Rescue does not treat the priority queue as a checklist. At each step it:

1. simulates making each unresolved measurement exact;
2. calculates the resulting decision stability;
3. selects the largest positive gain, with priority score as a deterministic tie-breaker;
4. repeats only when the first action does not meet the target;
5. stops when stable, no unresolved measurements remain, or no action provides a positive gain.

## Calibration tolerance

The prototype calls an estimate successful when relative error against human ground truth is at most `3%`:

```text
relativeError = abs(estimatedValue - verifiedValue) / verifiedValue
```

This threshold is explicit and configurable. It is illustrative, not an HVAC or metrology industry standard.

## Confidence buckets and ECE

Evidence is grouped into `0–10%`, `10–20%`, through `90–100%`. Each bucket exposes sample count, average predicted confidence, observed success rate, mean absolute and relative error, and signed calibration gap:

```text
calibrationGap = averagePredictedConfidence - observedSuccessRate
ECE = sum(abs(calibrationGap) * bucketSampleCount) / totalSampleCount
```

Positive gap means overconfidence; negative gap means underconfidence. Overall quality is only labeled after 20 samples. Context-specific adjustment additionally requires 12 scoped observations and 5 observations in the matching confidence bucket.

## Confidence correction

The suggested calibrated value is the observed success rate in the first sufficiently populated scope:

```text
exact model/capture/device/room context
-> measurement type
-> global
-> unchanged raw confidence
```

The engine receives the calibrated value as an optional override. Raw confidence remains attached to the original estimate for provenance and debugging.
