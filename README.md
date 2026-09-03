# HomeLens

**Know what actually needs checking.**

HomeLens looks at uncertain room measurements and tells you which one is worth verifying before it can change the result.

[![CI](https://github.com/JosvierR/HomeLens/actions/workflows/ci.yml/badge.svg)](https://github.com/JosvierR/HomeLens/actions/workflows/ci.yml)

## Live demo

**[https://homelens-kappa.vercel.app](https://homelens-kappa.vercel.app)**

Public **Try demo** needs no account. Capture guidance works with camera permission or a local demo fallback.

## Product vs demo

| Mode | Auth | Persistence | Learning |
|---|---|---|---|
| Try demo | No | Local / synthetic | Isolated (`synthetic_demo`) |
| Real product | Magic-link sign-in | Supabase Postgres + private Storage | `real_user_verification` only |

## Production loop

```text
Camera → useful frames → estimates → raw confidence
  → historical calibration → decision analysis
  → Next Best Capture (or stop)
  → human verification when needed
  → persistent evidence → Error Atlas → future policy
```

## Stack

- Nuxt 4 / Vue 3 / TypeScript / Nitro
- Zod contracts + deterministic decision engines in `shared/`
- Supabase Auth, Postgres RLS, private Storage
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
```

3. Apply migrations:

```powershell
npx supabase db reset
# or against a linked remote:
npx supabase db push
```

Never put a secret/service role key in `NUXT_PUBLIC_*`.

## Verify

```powershell
npm run test
npm run typecheck
npm run build
npm run qa:api      # requires dev server
npm run qa:visual   # Chrome harness on Windows
```

Database/RLS tests require a running local Supabase (`npx supabase test db`).

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Learning system](docs/LEARNING_SYSTEM.md)
- [Privacy](docs/PRIVACY_ARCHITECTURE.md)
- [Moat hypothesis](docs/MOAT.md)

## Intentionally not claimed

- Not Manual J / certified HVAC sizing
- Not production-trained computer vision that fabricates room dimensions from arbitrary frames
- Not a proven business moat until real evidence accumulates
