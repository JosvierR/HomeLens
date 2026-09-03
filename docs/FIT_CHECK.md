# Fit Check

Will it fit? checks a catalog of common furniture against the measured room, including the walkway each item needs. These are planning assumptions, not building-code compliance.

Clearance is always **available minus (footprint + required walkway)** on the tightest dimension after the best orientation. The number in the row and the sentence must match.

## Catalog

| Item | Footprint | Access space | Height |
| --- | --- | --- | --- |
| Queen bed | 60 × 80 in (5.0 × 6.67 ft) | 24 in walkway on one side | — |
| King bed | 76 × 80 in (6.33 × 6.67 ft) | 24 in walkway on one side | — |
| Bunk bed | Twin bunk, 3.5 × 6.67 ft | 24 in walkway on one side | 7.5 ft ceiling for the top bunk |
| 3-seat sofa | 84 × 36 in (7.0 × 3.0 ft) | 2.5 ft in front | — |
| L-shaped sectional | 108 × 78 in (9.0 × 6.5 ft) | 2.5 ft in front | — |
| Dining table for 6 | 72 × 36 in (6.0 × 3.0 ft) | 3 ft chair pull-out on both long sides (6 ft total) | — |
| Home office desk | 60 × 30 in (5.0 × 2.5 ft) | 3 ft for the chair | — |
| Washer and dryer | 5.2 × 2.6 ft side by side | 3 ft door swing | — |

## Orientation

Each item is tried with the long side along width and along length. The orientation with the higher fit probability is shown.

## Verdicts

| Probability | Label |
| --- | --- |
| ≥ 90% | Fits |
| 50–90% | Uncertain |
| < 50% | Doesn't fit |
| Missing required dimension | Not checked — never guessed |

If every dimension used in the check is human-verified, the result is deterministic: 100% or 0%, and the copy says “verified room dimensions.”

## What to check

When a result is Uncertain, Fit Check asks for the dimension whose verification would move the fit answer the most, not the lowest-confidence dimension. A long wall with lots of slack is ignored even if its confidence is worse.

## Demo room

`createUncertainFitDemoScan()` is synthetic. Width 9.4 ft (8.5–10.3, 77%) puts the sectional in the uncertain band. Verifying width at 9.8 ft fits; 8.9 ft does not.
