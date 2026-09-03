# Photo-metric benchmark report

Generated: 2026-09-03

Status: **not yet benchmarked on real rooms**. No private ground-truth dataset was available in this workspace, so reporting numerical accuracy would be fabrication.

| Metric | Width | Length | Height |
|---|---:|---:|---:|
| Dataset size | 0 | 0 | 0 |
| MAE | Not available | Not available | Not available |
| Median absolute error | Not available | Not available | Not available |
| P90 absolute error | Not available | Not available | Not available |
| Mean relative error | Not available | Not available | Not available |
| Within 2% | Not available | Not available | Not available |
| Within 5% | Not available | Not available | Not available |
| Within 10% | Not available | Not available | Not available |
| Confidence calibration | Not available | Not available | Not available |

Release gate: collect at least 25–50 consented rooms with three images and tape/laser ground truth, run `npm run benchmark:photo -- <private-dataset.json>`, inspect failures by device/lighting/room type, and choose confidence thresholds from those observed results. Production accuracy is not established until this report contains real results.
