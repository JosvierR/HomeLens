# Visual Audit — before the human design pass

Screenshots taken at 375 / 768 / 1440 before any code was modified. Sources: `artifacts/human-design-pass/before/`.

Measured inventory of `/analysis` at 1440px (`before/inventory.json`), collected by walking the rendered DOM:

| Metric | Before |
|---|---|
| Bordered/filled surfaces with radius ≥ 6px | 25 |
| Distinct radius values in use | 9 (`2, 7, 8, 9, 10, 11, 12, 18, 999`) |
| Full pills (`border-radius: 999px`) | 6 |
| Uppercase letter-spaced labels | 14 |
| Elements carrying a box-shadow | 9 |
| CSS gradients | 2 |
| Page height at 1440px | 2053px |
| Page height at 375px | 3955px |

---

## `/` — Home

**1. Template-like elements.** The three-step section is the canonical AI feature grid: three equal columns, each with a numeral (`01/02/03`), a decorative diagram, a bold title, and two lines of body copy, separated by circular arrow badges. This composition is the single most recognizable generated-UI signature on the page.

**2. Excessive surfaces.** The dark product preview is justified. Everything below it is not: the three story steps are boxed by borders on all sides of a `border-block` grid, creating three tall rectangles with nothing inside that needs containment.

**3. Excessive radii.** Preview shell at 20px, inner geometry at 0, status pill at 999px, buttons at 10px — four unrelated values on one composition, with no nesting logic.

**4. Excessive pills.** `Scan complete` status pill, plus three confidence pills in the preview measurement strip. The confidence pills are the load-bearing information and should not be styled like decorative tokens.

**5. Unnecessary copy.** `HOMELENS · MEASUREMENT INTELLIGENCE` is literally the "Intelligence for…" pattern. `From capture to confidence, without hiding uncertainty.` and `HomeLens treats human verification as part of good measurement—not as a failure state.` are VC-deck sentences. `Precision software for imperfect physical-world data.` in the footer repeats the hero. `Every estimate keeps its confidence and source.` restates what the preview visibly shows.

**6. Weak hierarchy.** The `h1` is `clamp(3.2rem, 5.25vw, 4.65rem)` and wraps onto four lines with a teal accent word. At 1440px the headline occupies more area than the actual product visualization, inverting the intended priority.

**7. Duplicated information.** Confidence percentages appear in the geometry labels *and* again immediately below in the measurement strip. The `1 verification could stabilize this decision` bar repeats what the ceiling-height review pill already says.

**8. Artificial symmetry.** The story section is a perfect 3×1 grid with equal 390px minimum heights and mirrored internal structure, despite the three steps having very different information density.

**9. Could be plain rows.** All three story steps. Each is a number, a title, and one sentence — a definition list, not three cards.

**10. Prominence exceeds importance.** The decorative capture/confidence/verify diagrams take roughly 200px of vertical space each and communicate nothing that the live product preview above them does not already show.

---

## `/scan` — Capture

This is the strongest of the three screens: the capture surface already dominates and the chrome already recedes. Problems are narrower.

**1. Template-like elements.** `ROOM CAPTURE` eyebrow → oversized headline → right-aligned explanatory paragraph is the standard generated section header.

**2. Excessive surfaces.** The three-node progress rail is a full-width band of chrome for a linear flow with one interactive step.

**3. Excessive radii.** Guidance checks, capture shell, and button use three unrelated radii.

**5. Unnecessary copy.** `Capture the room perimeter.` as a 2.6rem headline duplicates the `Live capture` label and the guidance sentence beneath it. `LIVE GUIDANCE` + `01` + a hero-sized instruction is three levels of framing for one sentence of instruction.

**6. Weak hierarchy.** The page headline is visually louder than the live instruction, which is the thing the user actually needs to read while capturing.

**10. Prominence exceeds importance.** The decorative `01` index and the uppercase eyebrow both outrank the instruction they introduce.

---

## `/analysis` — Analysis

This screen carries nearly all of the AI-generated signature.

**1. Template-like elements.** Seven independent white rounded cards floating on a canvas, each opening with an uppercase eyebrow and a rhetorical question headline: `Can you trust the current result?`, `Resolve the uncertainty that matters.`, `Is model confidence trustworthy?`, `What could change this decision?`. Rhetorical section headings inside a working tool are a marketing device, not a workspace device.

**2. Excessive surfaces.** 25 qualifying surfaces. Worse, they nest three deep: the Scan Rescue card contains a `Recommended verification` card which contains a bordered `Projected stability gain` block. The stability card contains a bordered three-cell fact grid. The sensitivity card contains a bordered two-pane grid. Containment is being used where alignment would do.

**3. Excessive radii.** Nine distinct values on one page. The nesting is also wrong in places — an 11px inner block inside a 18px outer card with 22px padding should be closer to 6px by the inner = outer − padding rule.

**4. Excessive pills.** `1 ACTION`, `INCLUDES DEMO EVIDENCE`, three confidence badges, `Recommended verification`, plus the header nav segmented control. Several of these are single-instance labels that will never vary — a pill implies a category among alternatives.

**5. Unnecessary copy.** `Your downstream decision is unstable. Start with the measurement projected to produce the largest useful gain.` `Editing an estimate records human provenance and recomputes the decision model.` `Select a dimension to trace it through the analysis.` `HomeLens compares prior model estimates with later human-verified measurements…` Each explains something the interface demonstrates on the next interaction.

**6. Weak hierarchy.** Required priority is: decision → stability → what to verify → measurements → why → calibration. Actual rendering gives the geometry the largest area, then places stability, rescue, and calibration in a right rail at identical widths and near-identical visual weight, so nothing reads as the next action.

**7. Duplicated information.** Ceiling height's 71% confidence appears five times: geometry label, measurement card badge, Scan Rescue block, calibration comparison, verification queue. The `78% → 99%` projection appears in both the stability panel prose and the Scan Rescue block. `Band B · Standard` and index `336` appear in both the stability facts and the sensitivity panel.

**8. Artificial symmetry.** Three measurement cards in an exactly equal 3-column grid. The right rail holds four stacked panels of near-identical height. Real analysis work is not evenly weighted.

**9. Could be plain rows.** The three measurement cards (one table). The `Floor area / Windows / Doors / Model status` four-cell bordered grid (four label/value pairs). The stability facts three-cell bordered grid. The calibration `Raw model → Historically calibrated` bordered comparison box.

**10. Prominence exceeds importance.** The 4.1rem stability number competes directly with the 2.7rem room title and the 2.1rem measurement values, so three different things claim the role of "the number on this page." The calibration panel — explicitly secondary to the user's job — occupies the same width and nearly the same height as Scan Rescue. `Model status: Inspectable` is a constant string given a dedicated cell.

**Mobile (375px).** 3955px tall. Card order is decision → rescue → calibration → geometry → measurements → sensitivity → queue, so calibration is reached before the room is ever shown, and every card keeps full desktop padding plus its own border, producing a long stack of near-identical rounded rectangles.

---

## The AI screenshot test — before

Posting `/analysis` without context would read as generated, and the concrete reasons are: a grid of white rounded cards on a tinted canvas; a tinted teal action card; four rhetorical section headings; uppercase letter-spaced eyebrows on every panel; pill badges on every value; three symmetric measurement cards; teal applied as ambient color across headline accents, progress fills, queue rows, and links rather than as a signal.
