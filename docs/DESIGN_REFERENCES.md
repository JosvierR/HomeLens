# Design References

Research performed before the human design pass on HomeLens.

**Method note:** a Mobbin subscription was not available in this environment. Instead of inventing screens, references were drawn from each product's public product surface and its published design-system documentation (Vercel Geist, Linear's stated philosophy). Where a claim comes from documentation rather than a screen, it is marked *(docs)*. Nothing below is a guess about a screen I could not see.

The goal is to borrow **decisions**, not visuals. HomeLens keeps its own identity around measurement, geometry, uncertainty, and human verification.

---

## Linear

**Screen / workflow:** issue list → issue detail with properties sidebar.

**Pattern observed:** the work surface holds nearly all visual weight. Navigation, metadata, and property labels sit at low contrast and small size; they are legible but never compete. Secondary information stays subtle by default. Linear's own framing is that the interface "reduces noise" so content dominates *(docs)*, and the widely-quoted rule is that an interface should not compete for attention it has not earned *(docs)*.

**Why relevant:** HomeLens has exactly three things a user cares about — the room, whether the decision is stable, and what to verify next. Everything else (planning index, scenario count, calibration scope, model version) is metadata that had been styled as loudly as the primary content.

**HomeLens adopts:** one visual tier for primary content (room name, stability number, recommended verification) and one much quieter tier for metadata. Property rows as label/value pairs rather than boxed statistics.

**HomeLens does not copy:** Linear's dark chrome, its keyboard-command surface, or its dense multi-project navigation. HomeLens has three routes and should not pretend otherwise.

---

## Vercel

**Screen / workflow:** deployments table and project detail; Geist table and radius documentation.

**Pattern observed:** Geist prescribes `tabular-nums` on numeric columns so digits align across rows for comparison *(docs)*. Corner radius is restrained — 6px small, 8px default, 12px large, pill reserved for actual pills *(docs)*. Borders delineate regions without becoming a design element; accent color is treated "like punctuation" rather than atmosphere *(docs)*. Unknown cells render an em dash rather than "N/A" *(docs)*. Nested radii follow inner = outer − padding *(docs)*.

**Why relevant:** HomeLens is a numbers product. Confidence, stability, impact, and planning index are all meant to be compared. The previous build had nine distinct radius values in one page and used teal as an ambient mood color.

**HomeLens adopts:** `tabular-nums` on every comparable number; a four-value radius scale (6/8/10/14) with correct nesting; accent used only for selection, primary action, and active state; em dash for unavailable calibration values.

**HomeLens does not copy:** the Geist typeface, near-zero marketing radii, or Vercel's black-and-white brand. HomeLens stays on a warm neutral canvas because it is a physical-world tool, not a deploy console.

---

## Stripe

**Screen / workflow:** payment detail page — a single object with a timeline and structured attribute lists.

**Pattern observed:** a detail page is organized as one object with attached facts, not as a grid of equally-weighted widgets. Attributes appear as aligned label/value rows. Explanatory text sits inline next to the value it explains rather than behind a tooltip. Status is communicated with a word plus a shape, not with color alone.

**Why relevant:** `/analysis` is a detail page for one room, but it had been built as a dashboard of seven independent cards, which made every fact look equally important.

**HomeLens adopts:** the room as the page subject with facts attached to it; inline explanation next to the number it qualifies; status words (`Estimated`, `Verified`, `Needs review`) carrying the meaning.

**HomeLens does not copy:** Stripe's event timeline, its blue/violet accent, or its dense financial-operations chrome.

---

## Attio

**Screen / workflow:** record view — a table-first workspace where structured data is directly editable.

**Pattern observed:** records live in a table with typed columns. Editing happens in place inside the cell; the layout does not change when a value is edited. The interface reads as a working surface, not as a presentation of results.

**Why relevant:** HomeLens had three sibling measurements rendered as three separate floating cards with their own borders, badges, and colored footer strips. They belong to one comparison task.

**HomeLens adopts:** a single measurement table on desktop with `Measurement / Value / Source / Confidence / Impact / Action` columns and true inline editing that does not restructure the row.

**HomeLens does not copy:** Attio's configurable column system, saved views, or CRM object model. HomeLens has one fixed schema.

---

## Ramp

**Screen / workflow:** approvals and bill review queues.

**Pattern observed:** the interface is organized around the next required action, not around reporting. The item needing a decision is stated plainly with the one control that resolves it. Analytics are available but subordinate.

**Why relevant:** the most important question on `/analysis` is "what should I verify next?" That answer had been wrapped in a tinted marketing card with a headline reading "Resolve the uncertainty that matters."

**HomeLens adopts:** Scan Rescue restated as a plain "Needs verification" block sitting directly above the measurement it refers to, with one primary button and a projected-stability figure; calibration demoted below it.

**HomeLens does not copy:** Ramp's approval routing, multi-role queues, or its purple accent.

---

## Raycast *(secondary)*

**Screen / workflow:** command list with detail pane.

**Pattern observed:** rows, not cards. Grouping comes from dividers and alignment; the surface stays almost flat. Hover raises contrast rather than moving the element.

**Why relevant:** HomeLens used `translateY` lift and a soft shadow on non-interactive information cards, which is a common AI-generated tell.

**HomeLens adopts:** row-and-divider grouping and contrast-only hover on genuinely interactive elements.

**HomeLens does not copy:** the command-palette interaction model.

---

## Cross-reference summary

| Decision | Source | Applied to |
|---|---|---|
| Metadata recedes; work surface dominates | Linear | All routes |
| `tabular-nums` on comparable numbers | Vercel Geist | Measurements, confidence, stability, impact, index |
| Four-value radius scale with correct nesting | Vercel Geist | `main.css` tokens |
| Accent as punctuation, not atmosphere | Vercel Geist | Color system |
| Detail page = one object plus attached facts | Stripe | `/analysis` |
| Inline explanation over tooltip | Stripe | Calibration, projection, impact |
| Table-first editable structured data | Attio | Measurement workspace |
| Organize around the next action | Ramp | Scan Rescue placement and copy |
| Rows and dividers instead of cards | Raycast | Queue, facts, workflow list |
