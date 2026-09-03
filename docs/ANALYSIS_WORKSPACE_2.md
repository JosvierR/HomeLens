# Analysis Workspace 2.0

Decision-first redesign of `/analysis`. Product logic, formulas, provenance and calibration are unchanged. Numbers remain reactive.

## Hierarchy

1. Recommendation (Almost stable / Stable / Needs a quick check)
2. What to check next + Room geometry
3. Measurements table
4. What could change this decision?
5. How sure is the system? (collapsed)
6. Technical details (collapsed)

## Files changed

- `app/pages/analysis.vue` — layout and verification feedback
- `app/components/RecommendationPanel.vue` — new primary decision block
- `app/components/ScanRescuePanel.vue` — “What to check next”
- `app/components/SensitivitySummary.vue` — friendlier language
- `app/components/CalibrationInsight.vue` — collapsed disclosure
- `app/components/TechnicalDetails.vue` — new collapsed technical section
- `app/components/MeasurementTable.vue` — Verify action on recommended row
- `app/assets/css/main.css` — page width 1280px
- `scripts/visual-qa.mjs` — selectors for new markup

## Screenshots

- Before: `artifacts/analysis-workspace-2/before/`
- After: `artifacts/analysis-workspace-2/after/`

## Remaining usability debt

- Recommendation and “What to check next” both offer Verify; intentional redundancy for mobile/desktop paths, but slightly duplicated on desktop.
- Planning band names remain Compact / Standard / High capacity — still abstract for non-technical users without a short glossary.
- After verification, feedback auto-clears after 8s; some users may want it sticky until dismissed.
