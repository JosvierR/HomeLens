# Ground Truth Calibration Data Flywheel

## Moat hypothesis

HomeLens can accumulate proprietary knowledge about when physical-world measurements are trustworthy.

The defensibility does not come from displaying confidence. It comes from linking:

```text
prediction
-> raw confidence
-> human verification
-> observed error
-> downstream decision impact
-> future calibration
```

This is a **data flywheel hypothesis**, not a claim that a scaled moat already exists.

## Why usage can increase value

Every verified estimate provides two kinds of ground truth: whether the model value was within an explicit tolerance and whether correcting it changed decision stability. With enough representative evidence, HomeLens can identify contexts where confidence is systematically over- or understated and can improve Scan Rescue ranking.

That can produce a compounding product effect:

- better reliability estimates reduce false reassurance;
- improved rescue ranking directs people to higher-value checks;
- fewer unnecessary checks improve completion rates;
- completed checks create more evidence;
- broader evidence supports safer contextual segmentation.

The repository boundary makes evidence durable in concept even though the prototype adapter is in memory. Model version, measurement type, capture method, device family, and room category are available for future segmentation, but minimum sample counts prevent the prototype from overfitting sparse contexts.

## Transparency requirements

- Raw model confidence must remain visible and unchanged.
- Calibrated confidence must include scope and real sample count.
- Synthetic history must be labeled demo evidence.
- Insufficient evidence must fall back to raw confidence.
- Tolerances, thresholds, and calibration equations must be inspectable.
- Calibration failure must not block the underlying analysis.

## Limitations and risks

- The current 72-record dataset is synthetic and proves behavior, not accuracy.
- Human verification is not automatically perfect ground truth; production workflows need measurement protocol and reviewer-quality controls.
- Evidence can be biased by which users choose to verify.
- Device and environment segments can become sensitive or too small to expose safely.
- Distribution shift and model-version changes require monitoring, version isolation, and expiration policies.
- The illustrative planning model and 3% tolerance are not certified domain standards.
- In-memory storage provides no durability, tenant isolation, deletion workflow, or production audit trail.

The hypothesis becomes credible only after consented, representative, quality-controlled production evidence demonstrates improved calibration and reduced human effort without hiding failure modes.
