# HomeLens

Capture a room with your phone.

HomeLens estimates room dimensions from multiple visual observations, quantifies uncertainty, and asks for additional evidence only when that uncertainty could affect a downstream decision.

[![CI](https://github.com/JosvierR/HomeLens/actions/workflows/ci.yml/badge.svg)](https://github.com/JosvierR/HomeLens/actions/workflows/ci.yml)

## Live product

**[https://homelens-kappa.vercel.app](https://homelens-kappa.vercel.app)**

Public **Try demo** needs no account and stays synthetic. **Scan a room** uses the real camera, private Storage, and GPU photo-to-metric inference when the Modal worker has credit and is configured.

## For reviewers

- Production is this `main` branch on Vercel. CI (`test`, `typecheck`, `build`) is required on every push.
- 60–90s product story: open [`/analysis?demo=1`](https://homelens-kappa.vercel.app/analysis?demo=1). That room is labeled **Demo** and is synthetic.
- Recording notes: [docs/ZERO_DEMO_SCRIPT.md](docs/ZERO_DEMO_SCRIPT.md)
- Fit-check assumptions: [docs/FIT_CHECK.md](docs/FIT_CHECK.md)
- Photo estimation from a real room needs a funded Modal GPU worker. If credits are exhausted, the camera still captures and stores private evidence; use physical measurements or the labeled demo for the decision story.

## Loop

```text
Photo estimation
→ uncertainty
→ decision stability
→ Next Best Capture
→ human ground truth
→ Error Atlas
```

## Product vs demo

| Mode | Auth | Persistence | Learning |
|---|---|---|---|
| Try demo | No | Local / synthetic | Isolated (`synthetic_demo`) |
| Real product | Optional (anonymous guest for demo scan) | Supabase Postgres + private Storage | `real_user_verification` only |

## Stack

- Nuxt 4 / Vue 3 / TypeScript / Nitro
- Zod contracts + deterministic decision engines in `shared/`
- Supabase Auth, Postgres RLS, private Storage
- GPU inference worker (`inference-worker/`) with Apple Depth Pro
- Vercel Web Analytics and Speed Insights (pageviews and vitals only; no room photos or identities)
- Optional PostHog (`NUXT_PUBLIC_POSTHOG_KEY`)

## Local setup

Node.js 22+.

```powershell
npm ci
copy .env.example .env
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

API docs (dev only, from Nitro OpenAPI):

- Scalar: [http://127.0.0.1:3000/_scalar](http://127.0.0.1:3000/_scalar)
- Swagger UI: [http://127.0.0.1:3000/_swagger](http://127.0.0.1:3000/_swagger)
- Spec: [http://127.0.0.1:3000/_openapi.json](http://127.0.0.1:3000/_openapi.json)

### Configure Supabase

Local Postgres/Auth/Storage is the official Supabase CLI stack. That uses Docker; do not wrap the Nuxt app in Docker.

1. Start Docker Desktop, then:

```powershell
npm run supabase:start
```

That boots the containers, applies migrations, and writes a BOM-free `.env` pointed at `http://127.0.0.1:54321`. Studio: [http://127.0.0.1:54323](http://127.0.0.1:54323).

2. Optional server-only inference (not required for local Auth/RLS):

```text
NUXT_INFERENCE_API_URL=...
NUXT_INFERENCE_API_TOKEN=...
NUXT_INFERENCE_CALLBACK_SECRET=...
NUXT_PUBLIC_SITE_URL=https://homelens-kappa.vercel.app
```

3. Reset local data / re-apply migrations:

```powershell
npx supabase db reset
# linked remote only:
npx supabase db push
```

Never put a secret/service role key or inference token in `NUXT_PUBLIC_*`.

## Verify

```powershell
npm run test
npm run typecheck
npm run build
python -m py_compile inference-worker/app.py
python inference-worker/test_payload.py
npm run benchmark:photo -- <private-dataset.json>
```

Database/RLS tests require a running local stack:

```powershell
npm run supabase:test
```

## Docs

- [Zero Homes demo script](docs/ZERO_DEMO_SCRIPT.md)
- [Fit Check](docs/FIT_CHECK.md)
- [Decision engine](docs/DECISION_ENGINE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Learning system](docs/LEARNING_SYSTEM.md)
- [Privacy](docs/PRIVACY_ARCHITECTURE.md)
- [Security](SECURITY.md)
- [Moat hypothesis](docs/MOAT.md)
- [Model licenses](docs/MODEL_LICENSES.md)
- [Benchmark report](docs/BENCHMARK_REPORT.md)

## Intentionally not claimed

- Not Manual J / certified HVAC sizing
- Not a claim that every phone photo recovers certified room scale
- Not statistically calibrated confidence until Error Atlas sample thresholds are met
- Not a proven business moat until real evidence accumulates
