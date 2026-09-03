# Ground Truth + Capture Policy Moat Hypothesis

## Moat hypothesis

HomeLens can accumulate proprietary knowledge about:

1. **Error Atlas** — where measurements fail and how wrong they are
2. **Next Best Capture Policy** — which additional evidence resolves each failure most efficiently
3. **Ground Truth Loop** — every real correction improves calibration and future evidence acquisition

```text
capture context
→ prediction
→ confidence
→ requested evidence
→ correction
→ actual error
→ downstream decision impact
→ future calibration + capture policy
```

The camera is not the moat.
Supabase is not the moat.
The decision formula alone is not the moat.

The compounding dataset connecting those steps is the moat **hypothesis**.

## Why usage can increase value

Verified estimates provide ground truth for error and decision impact.
Capture outcomes teach whether recommended frames were worth the effort.
With enough representative evidence, HomeLens can:

- reduce false reassurance via calibrated confidence
- ask for fewer, higher-value captures
- improve verification ranking

## Transparency requirements

- Raw model confidence remains visible and unchanged
- Calibrated confidence includes scope and sample count
- Synthetic history stays labeled and isolated from production learning
- Insufficient evidence falls back to raw confidence
- Utility formula and STOP rule are inspectable

## Limitations and risks

- No claim of defensibility before real usage proves it
- Human verification is imperfect ground truth
- Sparse segments must not overfit (sample thresholds)
- Model-version changes require isolation
- Imagery retention and deletion policies must stay privacy-first

This becomes credible only after consented, representative production evidence improves calibration and reduces human effort without hiding failure modes.
