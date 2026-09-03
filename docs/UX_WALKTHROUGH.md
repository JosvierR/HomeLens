# UX Walkthrough — Friendly product experience

Heuristic walkthrough after the friendly pass. Personas are simulated; findings drove copy and flow changes.

## A. Homeowner (no engineering background)

**Path:** Home → Scan → Analysis → Check measurement

| Question | Finding | Fix applied |
|---|---|---|
| What confused me? | “Decision confidence” and “physical-world measurements” felt like a research paper. Fake `42%` on scan felt meaningless. | Home hero is now “Know what actually needs checking.” Scan shows `3 of 4 useful views`, not a fake percentage. |
| What did I think the number meant? | The big % read as “accuracy of the whole house.” | Label is “How reliable is this result?” with short homeowner copy first. |
| Did I know what to do? | Scan jumped straight into “live capture” with no choice. | Camera is gated: Enable camera / Use demo scan. One instruction at a time. |
| Did I understand why? | “Projected stability 78→99” was opaque. | Copy: “Checking it could make your result much more reliable” plus the same numbers as support. |

## B. Contractor

**Path:** Try the demo → Analysis → Check ceiling height

| Question | Finding | Fix applied |
|---|---|---|
| What confused me? | Too many equal-weight panels before the action. | Recommendation block still leads; technical calibration stays collapsed. |
| What did the number mean? | Band names Compact/Standard still abstract, but acceptable once “planning result” is mentioned once. | Kept band name as secondary context, not the headline. |
| Did I know what to do? | Yes — Check ceiling height is the primary control. | Renamed primary CTA from Verify to Check in the recommendation surface. |
| Did I understand why? | Needed impact in plain language. | “What to check next” explains that this check helps more than the others. |

## C. Software engineer

**Path:** Expand How this works / How HomeLens decided this / Technical details

| Question | Finding | Fix applied |
|---|---|---|
| What confused me? | Nothing critical; depth was buried appropriately. | Technical details, calibration disclosure, and Why-this technical panel remain. |
| What did the number mean? | Clear once expanded: scenario share, impact score, provenance. | No change to engines. |
| Did I know what to do? | Yes. | — |
| Did I understand why? | Yes — rescue ranking and calibration remain inspectable. | — |

## Camera states covered in UI

| State | User sees |
|---|---|
| not_requested | Enable camera + Use demo scan |
| requesting | Asking for camera access… |
| granted | Live camera under geometry overlay + guided capture |
| denied / unavailable / no_camera / insecure_context | Friendly error + Try again + Use demo scan |

Camera is never requested on page load.

## Remaining soft spots

- Planning band names remain product jargon for homeowners; a one-line glossary could help later.
- Demo capture still simulates geometry rather than deriving dimensions from frames.
- Desktop still shows both “Check …” in the recommendation card and “Check this measurement” in the side panel.
