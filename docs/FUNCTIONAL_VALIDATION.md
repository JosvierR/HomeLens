# Functional Validation

Validation date: 2026-09-02  
Environment: local Nuxt 4 development server and production Node build on Windows  
Evidence: `artifacts/functional-qa/api-results.json` and `artifacts/visual-qa/results.json`

## Baseline

| Check | Result |
|---|---|
| `npm install` | PASS; postinstall generated Nuxt types |
| Initial `npm run test` | PASS; 4/4 pre-existing tests |
| Initial `npm run typecheck` | PASS |
| Initial `npm run build` | PASS |

## Functionality matrix

| Feature | Expected behavior | Test method | Result | Issues found | Fix | Status |
|---|---|---|---|---|---|---|
| Landing load | HomeLens identity and meaningful content render | Direct browser navigation at seven viewports | Identity, hero, preview, and actions rendered | None | — | PASS |
| Start Scan | Primary action opens `/scan` | Automated click | Path changed to `/scan` | None | — | PASS |
| Sample Analysis | Secondary action targets `/analysis` | DOM contract and direct navigation | Valid href and rendered analysis | None | — | PASS |
| Browser history | Back and forward preserve valid routes | Automated start, back, forward | `/scan` → `/` → `/scan` | None | — | PASS |
| Refresh/direct URL | Analysis survives refresh and direct entry | CDP navigation and hard reload | Heading and decision restored | None | — | PASS |
| Runtime health | No console errors, hydration warnings, overlays, or blank pages | Runtime event monitor and DOM inspection | Zero normal runtime issues across 21 route/viewports | None | — | PASS |
| Responsive layout | No horizontal scroll or clipped controls | 320, 375, 430, 768, 1024, 1280, 1440 widths | Zero overflow and zero overflowing elements | None after prior UI refactor | Responsive grid retained | PASS |
| Scan guidance | Context, progress, and capture geometry render | Browser inspection on desktop/mobile | Guidance and room model visible | None | — | PASS |
| Completion idempotency | Capture cannot complete twice | Two immediate clicks | Button disabled after first transition; one route change | Previous code guard existed but lacked validation | Added automated assertion | PASS |
| Scan completion | Controlled transition reaches analysis | Automated click and wait | `/analysis` rendered | None | — | PASS |
| Navigation state | Verified scan survives SPA navigation | Verify, navigate Home, return Analysis | Manual provenance remained | Full reload intentionally restores serialized/default state | Tested SPA semantics explicitly | PASS |
| Reset | Demo state restores without evidence/provenance corruption | Verify then Reset | Height returned to 9.1 ft / Estimated | None | Centralized demo factory | PASS |
| Measurement contract | Required id, label, value, unit, confidence, source | Schema unit tests and live API requests | Valid payload accepted | Contract previously allowed duplicate IDs and missing required dimensions until engine execution | Added strict schema and cross-field validation | PASS |
| Numeric safety | Reject negative, zero, NaN/null, Infinity/null, and extreme values | Unit matrix and HTTP matrix | All rejected | No explicit upper bound previously | Added finite `0 < value <= 100 ft` prototype bound | PASS |
| Confidence safety | Confidence remains in `0..1` | Unit and HTTP matrix | Above/below bounds rejected | None | Retained and expanded runtime validation | PASS |
| Units and source | Only `ft`, `estimated`, and `manual` are recognized | Unit and HTTP matrix | Unknown values rejected | None | Strict enums retained | PASS |
| Unique IDs | Duplicate measurement IDs rejected | Unit and HTTP payload | HTTP 400 `INVALID_REQUEST` | Previously not enforced | Added scan-level uniqueness refinement | PASS |
| Missing/empty measurements | API rejects incomplete scans before engine | Live HTTP requests | Predictable HTTP 400 response | Engine previously threw for missing width/length/height | Required-ID validation moved to contract | PASS |
| Malformed JSON | API returns safe predictable failure | Raw malformed request | HTTP 400 `MALFORMED_JSON`, no stack | Raw framework/Zod errors were not normalized | Added API contract layer | PASS |
| Engine failure contract | Unexpected engine error hides internals | Injected handler-contract unit test | HTTP mapping is 500 `ENGINE_ERROR`, no private message/stack | No explicit engine error shape | Added isolated engine wrapper | PASS |
| Deterministic scenarios | Same input/config returns same output | Unit equality and repeated HTTP request | Byte-equivalent JSON results | Existing single test was narrow | Added sample-count and HTTP reproducibility checks | PASS |
| Stability bounds | Stability/distribution always use `0..1` | Single, multiple, low, and fully verified cases | Values bounded; distribution sums to 1 | Fully verified inputs previously retained a 1% spread | Zero spread at confidence 1 | PASS |
| Fully verified decision | Exact inputs produce deterministic band | Unit test | Stability 1 and zero-width scenario range | Same minimum-spread issue | Corrected uncertainty formula | PASS |
| Verification priority | Impact and uncertainty both affect ranking | Low-confidence irrelevant vs higher-confidence sensitive case | Sensitive measurement ranked first | Existing test only checked descending sort | Added causal ranking test and documented formula | PASS |
| Scan Rescue stable | Stable decision requests no work | Unit test | Empty actions and stable status | None | — | PASS |
| Scan Rescue one action | Best positive projected gain is first | Unit/browser/API tests | Ceiling height selected | Existing response lacked explicit gain and evidence context | Added transparent action fields | PASS |
| Scan Rescue multi-action | Additional actions planned only if needed | Very uncertain strict-target test | Multiple actions reach target | Existing engine returned at most one action | Added greedy minimum-useful sequence | PASS |
| Verified queue removal | Manual input no longer appears unresolved | Unit, API, and browser flow | Height removed after save | Manual measurements previously stayed in queue | Filtered manual provenance in engine | PASS |
| Inline verification validation | Invalid edit cannot submit | Browser input `0` | Error visible and submit disabled | Timing was initially underspecified in harness | Awaited Vue update and asserted state | PASS |
| Server verification | Valid human value updates accepted state | HTTP and browser flow using 9.0 ft | Value 9, source manual, confidence 1 | UI previously mutated only client state | Added server-owned transaction | PASS |
| Verification failure | Failed request leaves estimate understandable | Intentional analysis-API outage plus component error states | Error shown; geometry remains inspectable | Success was previously optimistic | Success feedback now waits for server response | PASS |
| Provenance | Original estimate is never silently destroyed | Unit/API/browser inspection | 9.1 ft and 71% retained with verified timestamp | Previous update overwrote value/confidence | Added `originalEstimate`, `rawConfidence`, and verification metadata | PASS |
| Evidence creation | Verification records prediction/error/impact | HTTP verification workflow | Error and before/after stability recorded | Not implemented | Added `MeasurementEvidence` and repository write | PASS |
| Calibration buckets | Ten ranges expose counts, success, error, and gap | Perfect, mixed, over/under, outlier tests | Deterministic summaries | Not implemented | Added pure calibration module | PASS |
| Calibration sample safety | Small/zero evidence is not treated as meaningful | Zero and small-sample tests | `insufficient` and unchanged raw fallback | Not implemented | Added minimum thresholds | PASS |
| Context fallback | Exact → type → global → raw | Dedicated unit cases | Each scope selected correctly | Not implemented | Added deterministic hierarchy | PASS |
| Raw/calibrated separation | Calibration never overwrites model output | Unit/API/browser inspection | Raw 71%, calibrated 67%, both shown | Single confidence field was insufficient | Added optional effective override and insight UI | PASS |
| Calibration failure isolation | Basic analysis continues on calibration errors | Invalid-evidence unit injection | Raw result equals uncalibrated result | Not implemented | Catch and raw fallback in analysis orchestration | PASS |
| Calibration-informed rescue | Sufficient evidence can change ranking | Controlled reliability override test | Width outranked otherwise stronger candidates | Rescue used raw confidence only | Added calibrated reliability input | PASS |
| Learning feedback | Successful verification acknowledges evidence | Browser flow | Honest saved/evidence message shown | No calibration feedback | Added subtle status panel and live announcement | PASS |
| Evidence repository | Storage adapter is replaceable and defensive | Repository unit test | List/add/find and copy isolation pass | No abstraction | Added async interface and in-memory adapter | PASS |
| Analytics contract | Events exclude sensitive household data | Unit allowlist test and workflow instrumentation | Identifiers/address discarded | Configuration existed without contract | Added typed adapter and safe properties | PASS |
| API call efficiency | Scan changes trigger one consolidated analysis request | Architecture inspection and composable request counter | One debounced endpoint; prior request aborted | Decision and rescue previously issued separate calls | Added `/api/analysis` and stale-request cancellation | PASS |
| Accessibility contracts | Buttons named and inputs labeled | Automated DOM inspection at all viewports | Zero unnamed buttons/unlabeled inputs | None | Existing accessible refactor preserved | PASS |
| API outage | User can still inspect scan when analysis is unavailable | Browser network block | Readable retry state; geometry remains visible | None | Consolidated graceful failure state | PASS |
| Production build | Server and client bundles compile | `npm run build` | Build completed | Upstream dependency/plugin warnings only | No errors suppressed | PASS |

## Automated coverage summary

- Unit/domain suite: 44 tests across 7 files.
- Live API suite: 41/41 checks.
- Browser routes: Home, Scan, Analysis.
- Viewports per route: 320×568, 375×812, 430×932, 768×1024, 1024×768, 1280×800, 1440×900.
- Normal browser console/hydration issues: 0.
- Horizontal-overflow findings: 0.

## Known limits of validation

The camera workflow is simulated, evidence persistence is in memory, demo history is synthetic, and the planning/tolerance rules are illustrative. Browser automation used an isolated Chrome DevTools Protocol harness because the `agent-browser` executable was unavailable in this environment. This validation does not establish certified measurement or HVAC accuracy.
