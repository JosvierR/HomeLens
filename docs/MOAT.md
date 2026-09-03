# Ground Truth + Capture Policy Moat Hypothesis

## Moat hypothesis

### Error Atlas

Understands where visual measurements fail.

### Confidence Calibration

Learns when model confidence is over/under-stated.

### Next Best Capture Policy

Learns which additional view resolves uncertainty most efficiently.

### Decision Impact

Only spends user effort on uncertainty that can affect the downstream result.

### Ground Truth Loop

Every verified correction strengthens future inference and capture policy.

```text
capture context
→ prediction
→ uncertainty
→ decision stability
→ Next Best Capture
→ human ground truth
→ Error Atlas
→ future calibration + capture policy
```

The monocular depth model is not the moat.

The camera is not the moat.

Supabase is not the moat.

The accumulated mapping from capture context → prediction → uncertainty → intervention → verified error → downstream impact is the moat hypothesis.

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
