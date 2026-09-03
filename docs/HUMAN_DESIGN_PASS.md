# Human design pass

A visual and interaction pass whose only goal was to remove the visual fingerprints of generated UI. No product logic, decision formula, feature, or dependency changed. Research is recorded in [DESIGN_REFERENCES.md](./DESIGN_REFERENCES.md); the pre-change audit is in [VISUAL_AUDIT.md](./VISUAL_AUDIT.md). Before/after screenshots are in `artifacts/human-design-pass/`.

## Measured result

Inventory of `/analysis` at 1440px, collected by walking the rendered DOM (`artifacts/human-design-pass/*/inventory.json`):

| Metric | Before | After |
|---|---|---|
| Bordered/filled surfaces with radius ≥ 6px | 25 | 5 |
| Distinct radius values | 9 | 5 |
| Full pills (`border-radius: 999px`) | 6 | 0 |
| Uppercase letter-spaced labels | 14 | 0 |
| Elements with a box-shadow | 9 | 2 |
| CSS gradients | 2 | 0 |
| `/analysis` height at 1440px | 2053px | 1534px |
| `/analysis` height at 768px | 3168px | 2270px |
| `/analysis` height at 375px | 3955px | 2705px |
| Home height at 1440px | 1620px | 1513px |
| Home height at 375px | 2695px | 1791px |

The two remaining shadows are the inset selection rules on the measurement table and queue, which are structural rather than elevation. The five remaining radii are `6/8/10/14` plus the `2px` used on progress rules.

---

## The 20 changes that mattered

### 1. Three measurement cards became one measurement table

**Before.** Three equal-width cards in a 3-column grid, each with its own border, shadow, 2.1rem value, confidence pill, impact footer, and a tinted "Recommended verification" strip.

**Problem.** All three entries belong to a single comparison task. Containing each one separately made comparison harder and produced the most recognizable generated-UI signature on the page.

**Reference.** Attio record view (table-first editable structured data); Vercel Geist table guidance.

**Change.** A real `<table>` with `Measurement / Value / Source / Confidence / Impact / Action` columns, `tabular-nums` on every numeric column, and row rules instead of card borders. Below 700px each row becomes a labelled block in the same reading order rather than a horizontal scroller.

**Why it feels more intentional.** Values now align vertically, so 14.2 / 18.6 / 9.1 and 94 / 88 / 71 read as a comparison instead of three unrelated statistics.

### 2. Editing happens in the row, not in a restyled card

**Before.** Clicking Edit replaced the card body with a labelled form block, changed the card height, and swapped in a "Save verified value" button.

**Problem.** The layout reshuffled around a one-field edit.

**Reference.** Attio inline cell editing.

**Change.** The value cell becomes a right-aligned numeric input; the action cell becomes `Save` / `Cancel`. Nothing else moves. Escape cancels, Enter submits.

**Why.** It reads as editing a value, not as opening a form.

### 3. Scan Rescue stopped being a marketing card

**Before.** A tinted teal panel with an equalizer glyph, an uppercase `SCAN RESCUE` kicker, a `1 ACTION` pill, the headline "Resolve the uncertainty that matters.", a sentence of framing copy, and a nested white card containing another nested bordered block.

**Problem.** The most important element on the page was styled as an advertisement for itself, three container levels deep.

**Reference.** Ramp approvals — organize around the next required action.

**Change.** A `Needs verification` section label, the measurement name, its current value and confidence, a projected-stability row, one primary button, and a `Why this measurement?` disclosure. One surface, no glyph, no pill, no gradient.

**Why.** It now looks like the next task in a queue, which is what it is.

### 4. Rhetorical section headings were deleted

**Before.** "Can you trust the current result?", "Resolve the uncertainty that matters.", "Is model confidence trustworthy?", "What could change this decision?"

**Problem.** Rhetorical questions are a landing-page device. Inside a tool they cost a line of vertical space and tell the user nothing.

**Change.** "Decision stability", "Needs verification", "Confidence calibration", "Scenario sensitivity".

**Why.** A section label should name the section.

### 5. Uppercase letter-spaced eyebrows removed entirely

**Before.** 14 elements with `text-transform: uppercase` and `letter-spacing: 0.11em` — `ROOM ANALYSIS`, `MEASURED INPUTS`, `SYSTEM CONFIDENCE`, `INCLUDES DEMO EVIDENCE`, `3 WINDOWS`, and so on.

**Problem.** Every panel was announcing itself at the same volume.

**Reference.** Linear — metadata recedes.

**Change.** Zero uppercase labels. A single `.section-label` style at 0.79rem/620 in secondary text.

### 6. Four rail cards became one column with a vertical rule

**Before.** Decision stability, Scan Rescue, calibration, and the queue were four separate bordered cards stacked at identical widths.

**Problem.** Four equal boxes communicate four equally important things. They are not equally important.

**Reference.** Linear issue-detail property sidebar; Raycast row grouping.

**Change.** One rail with a single 1px left border, sections separated by horizontal rules. Calibration was moved out of the rail into the main column, below scenario sensitivity.

**Why.** The rail now holds exactly the decision, the next action, and the queue, which is the only content that earns that position.

### 7. Calibration demoted to a compact technical disclosure

**Before.** A card the same size as Scan Rescue, with a bordered `Raw model → Historically calibrated` comparison box, a 1.45rem teal figure, a two-cell fact grid, and an `INCLUDES DEMO EVIDENCE` pill.

**Problem.** Calibration is technically the most interesting part of the product and operationally the least urgent. Its prominence matched the former, not the latter.

**Change.** Two aligned label/value rows (`Raw model 71%`, `Calibrated 67%`), a single sentence stating the sample count, quality, and — where applicable — that the evidence is synthetic, plus a `How calibration works` disclosure. Renders `—` rather than a number when no adjustment is applied.

**Why.** It stays fully inspectable without competing with the user's actual job.

### 8. Confidence badges became confidence values

**Before.** A pill per measurement: coloured background, coloured border, a `●`/`◆`/`▲` glyph, a word (`High`/`Moderate`/`Review`), a divider, and the percentage.

**Problem.** The number was the information and the pill was the decoration, but the pill was carrying the visual weight. Three saturated colours across three rows also made confidence look like a category rather than a scale.

**Change.** The percentage in tabular figures as primary text. A `▲ Needs review` marker appears only below the 0.75 threshold. No background, no border, no pill.

**Why.** Confidence is still readable without colour (number + word + shape), and the page dropped from six pills to zero.

### 9. Status vocabulary reduced to five words

**Before.** `High`, `Moderate`, `Review`, `Estimated`, `Human verified`, `Scan complete`, `Needs one verification`, `No rescue needed`, `Inspectable`, `Moderate` (impact), `Insufficient evidence`.

**Problem.** At least four of those meant roughly "this is fine" and three meant roughly "look at this".

**Change.** The vocabulary is now `Estimated`, `Verified`, `Needs review`, `Needs N verification(s)`, `Stable`. Impact keeps its own scale (`Low` / `Moderate` / `High`) because it measures a different thing.

### 10. `Human verified` became `Verified`

**Reference.** Sentence case and minimal capitalization.

**Change.** The source column reads `Estimated` or `Verified`, with the prior estimate shown beneath as `was 9.1 ft at 71%`.

**Why.** "Human" was doing no work: nothing else in the product verifies anything.

### 11. Decorative gradients removed

**Before.** A `linearGradient` floor fill in the room SVG and a teal `radial-gradient` spotlight behind the capture canvas, plus a `repeating-linear-gradient` segmented stability track and a `backdrop-filter: blur` on both the app header and the capture completion overlay.

**Change.** Flat 4.5%-opacity floor fill, no spotlight, a solid 4px stability rule, opaque header and overlay. Zero gradients remain in the rendered page.

### 12. Room geometry redrawn as a technical drawing

**Before.** 1.5px round-capped teal dimension lines, 44px-tall rounded label boxes carrying both the value and a confidence percentage, an accent-tinted origin halo.

**Problem.** It read as an illustration of a room rather than a measured drawing, and it repeated confidence figures that appear three more times on the page.

**Reference.** Architectural drafting conventions.

**Change.** 1px square-capped dimension lines, endpoint dots at each terminus, compact 4px-radius labels carrying only the value, and a `▲` flag on any dimension below threshold. Dimensions render in neutral grey and turn accent-coloured only when selected.

**Why.** The drawing is now one of the few visually distinctive surfaces in the product, and it earns that through precision rather than colour.

### 13. Home hero cut roughly in half

**Before.** `HOMELENS · MEASUREMENT INTELLIGENCE` eyebrow, a `clamp(3.2rem, 5.25vw, 4.65rem)` headline wrapping to four lines with a teal accent word, an intro paragraph, two CTAs, and a footnote.

**Problem.** The headline occupied more area at 1440px than the product visualization beneath it.

**Change.** No eyebrow, no accent word, no footnote. A `clamp(1.9rem, 3.6vw, 2.5rem)` headline in one colour, one paragraph, and two CTAs — `Start scan` and `Open sample`.

### 14. The three-column feature grid was deleted

**Before.** Three equal 390px-minimum columns, each with an `01/02/03` numeral, a decorative diagram (a skewed rectangle, three confidence bars, a stability figure), a title, and two lines of copy, joined by circular arrow badges.

**Problem.** This is the single most recognizable generated-UI composition, and none of the three diagrams showed anything the live product preview above them did not already show.

**Change.** Three divider-separated rows: index, title, one sentence. No diagrams, no arrows, no boxes.

### 15. The product preview became the largest element on the page

**Before.** A dark panel beside the headline, with a fake browser chrome dot, a `Scan complete` pill, and an equalizer glyph in its footer.

**Change.** Full container width below the hero copy, at `--radius-media`. The chrome dot, pill, and glyph are gone; the caption is the room name and measurement count. The footer states the actual projected stability gain from live state and links into `/analysis`.

### 16. Marketing copy removed from the workspace

Deleted from `/analysis`: "Your downstream decision is unstable. Start with the measurement projected to produce the largest useful gain.", "Select a dimension to trace it through the analysis.", "Standard planning range", "Model status / Inspectable", and the second copy of `Band B · Standard` + index + range that appeared in both the stability panel and the sensitivity panel.

Deleted from `/`: "From capture to confidence, without hiding uncertainty.", "A calmer measurement workflow", "HomeLens treats human verification as part of good measurement—not as a failure state.", "Every estimate keeps its confidence and source.", "Precision software for imperfect physical-world data."

Deleted from `/scan`: the `ROOM CAPTURE` eyebrow, the `clamp(1.9rem, 4vw, 2.85rem)` headline "Capture the room perimeter.", its right-aligned explanatory paragraph, the `LIVE GUIDANCE` eyebrow, and the decorative `01` index.

### 17. Navigation reduced to a brand and one action

**Before.** A segmented three-item control (`Home` / `Scan` / `Analysis`) in a bordered, tinted container, plus a filled `+ New scan` button, in a 68px blurred sticky header.

**Problem.** A three-route prototype was wearing enterprise navigation chrome, and the filled header button competed with `Verify measurement` for primary-action status.

**Reference.** Linear — navigation recedes.

**Change.** A 52px header with the brand and a single quiet `New scan` text link, which hides itself on `/scan`. The duplicate `New scan` button in the room header was removed; that row now holds only `Reset sample` as a ghost button.

**Why.** `Verify measurement` is now the only filled button anywhere on `/analysis`.

### 18. The scan progress rail was replaced by a text indicator

**Before.** A full-width three-node rail with connector lines and circular step markers, plus a separate room-status block and a percentage readout.

**Change.** `Step 1 of 3 · Capturing perimeter` beneath the room name in the header. The reclaimed vertical space went to the capture surface, which now targets `min(780px, 100vh - 130px)`.

**Why.** On the one screen whose entire job is capture, the capture area should be the page.

### 19. Empty, loading, and error states restated calmly

- **Empty.** The 52px outlined-house icon, the sentence "No measurements available for this scan.", and the explanation were replaced by "No measurements yet" / "Complete a room scan to generate measurements." / `Start scan`.
- **Loading.** The shimmer sweep animation was removed from skeletons; they are now flat blocks sized to the content they replace. Recalculation shows a local `Recalculating…` label rather than a spinner.
- **Error.** The red-bordered alert panel became "Decision analysis is temporarily unavailable. / Your room measurements are still available." with a `Retry analysis` button, on a low-saturation wash.

### 20. Hover and motion reduced to feedback only

**Before.** Buttons translated 1px on `:active`, information cards declared a `transform` transition, `scroll-behavior: smooth` was global, the recomputing indicator ran an infinite alternating pulse, skeletons looped a shimmer sweep, and transitions ran at 160–240ms across decorative properties.

**Change.** Hover raises border or text contrast only, and only on interactive elements. Control transitions are 140ms, width transitions on the stability and distribution bars are 200ms, and the capture overlay is 160ms. Nothing animates except in response to input or state.

---

## Design tokens

`app/assets/css/main.css` previously defined 22 colour variables including six near-identical greys, and four radius variables that were applied inconsistently enough to produce nine distinct rendered values. The token set is now:

- **Surfaces:** `--canvas`, `--surface`, `--surface-subtle`, `--surface-inverse`
- **Text:** `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-inverse`
- **Structure:** `--border`, `--border-strong`
- **Signal:** `--accent` (+ `--accent-hover`), `--success`, `--warning`, `--danger` (+ `--danger-wash`)
- **Radius:** `--radius-control` 6px, `--radius-input` 8px, `--radius-panel` 10px, `--radius-media` 14px

Nesting follows inner = outer − padding, so the 14px geometry surface contains a 0-radius drawing and the 10px rescue block contains 6px controls.

Accent is now used only for selection, the primary action, and active state. Every remaining comparable figure carries `font-variant-numeric: tabular-nums` via the `.numeric` utility.

---

## Verification

| Gate | Result |
|---|---|
| `npm run test` | 44 passed / 7 files |
| `npm run typecheck` | pass |
| `npm run build` | pass, 4.13 MB (1.03 MB gzip) |
| `npm run qa:api` | 41 / 41 |
| `npm run qa:visual` | 19 / 19, 0 overflow pages |

Browser QA covered `/`, `/scan`, `/analysis` at 320, 375, 430, 768, 1024, 1280 and 1440px. No horizontal overflow, no unnamed controls, no unlabeled inputs, no console or hydration errors. Confidence remains legible without colour. The full verification flow — geometry selection, Scan Rescue, inline edit, save, provenance, calibration update, navigation persistence, reset, and input validation — was exercised end to end after the redesign.
