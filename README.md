# HomeLens

Capture a room with your phone.

HomeLens estimates room dimensions from multiple visual observations, quantifies uncertainty, and asks for additional evidence only when that uncertainty could affect a downstream decision.

[![CI](https://github.com/JosvierR/HomeLens/actions/workflows/ci.yml/badge.svg)](https://github.com/JosvierR/HomeLens/actions/workflows/ci.yml)

## Live product

**[https://homelens-kappa.vercel.app](https://homelens-kappa.vercel.app)**

Public **Try demo** needs no account and stays synthetic. **Scan a room** uses the real camera, private Storage, and GPU photo-to-metric inference when the worker is configured.

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
| Real product | Email OTP code | Supabase Postgres + private Storage | `real_user_verification` only |

## Stack

- Nuxt 4 / Vue 3 / TypeScript / Nitro
- Zod contracts + deterministic decision engines in `shared/`
- Supabase Auth, Postgres RLS, private Storage
- GPU inference worker (`inference-worker/`) with Apple Depth Pro
- Optional PostHog (`NUXT_PUBLIC_POSTHOG_KEY`)

## Local setup

Node.js 22+.

```powershell
npm ci
copy .env.example .env
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

### Configure Supabase

1. Create a Supabase project (or start local stack with Docker Desktop):

```powershell
npx supabase start
npx supabase status -o env
```

2. Set:

```text
NUXT_PUBLIC_SUPABASE_URL=...
NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Optional server-only:

```text
SUPABASE_SECRET_KEY=...
NUXT_INFERENCE_API_URL=...
NUXT_INFERENCE_API_TOKEN=...
NUXT_INFERENCE_CALLBACK_SECRET=...
NUXT_PUBLIC_SITE_URL=https://homelens-kappa.vercel.app
```

3. Apply migrations:

```powershell
npx supabase db reset
# or against a linked remote:
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

Database/RLS tests require a running local Supabase (`npx supabase test db`).

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Learning system](docs/LEARNING_SYSTEM.md)
- [Privacy](docs/PRIVACY_ARCHITECTURE.md)
- [Moat hypothesis](docs/MOAT.md)
- [Model licenses](docs/MODEL_LICENSES.md)
- [Benchmark report](docs/BENCHMARK_REPORT.md)

## Intentionally not claimed

- Not Manual J / certified HVAC sizing
- Not a claim that every phone photo recovers certified room scale
- Not statistically calibrated confidence until Error Atlas sample thresholds are met
- Not a proven business moat until real evidence accumulates
