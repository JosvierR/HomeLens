# Final Photo-to-Metric release inventory

Recorded before finishing remaining production wiring. No files were reset or discarded.

## Git

- Branch: `main`
- HEAD at inventory: `165ab0016a26f22e3f1b326e6fa4aa0388a9b52a`
- Remote: `https://github.com/JosvierR/HomeLens.git`
- Working tree at inventory: modified Photo-to-Metric files plus untracked worker, APIs, shared geometry, tests, and `20260903160511_photo_metric_estimation.sql`

## Tooling

- Node: 24.19.0 (engines require >=22; CI uses 22)
- npm: 11.17.0
- Python: 3.12.10
- Nuxt 4.5.x, Vue 3.5, Vitest 3.2, TypeScript 5.9, supabase CLI 2.116

## Production URLs

- HomeLens: https://homelens-kappa.vercel.app
- Vercel project: `josvierrs-projects/homelens`
- Supabase project: `HomeLens` / `xfezgfmyyyaetfvtrjup` (us-west-2, linked)

## Migrations present

Already on git / previously applied in camera persistence:

1. `20260903061133_production_system_v1.sql`
2. `20260903061135_storage_scan_evidence.sql`
3. `20260903142812_add_scan_opening_counts.sql`

Pending until this release push:

4. `20260903160511_photo_metric_estimation.sql`

Apply in that chronological order. Do not apply 4 before 3.

## Inference worker state at inventory

- Source: `inference-worker/app.py` (Apple Depth Pro + RANSAC geometry)
- Image: `inference-worker/Dockerfile` pins Depth Pro `9efe5c1def37a26c5367a71df664b18e1306c708`
- Modal wrapper: `inference-worker/modal_app.py`
- GPU host: not deployed at inventory time
- Auth: bearer `INFERENCE_API_TOKEN` plus HMAC `INFERENCE_CALLBACK_SECRET`

## Modified / untracked classes

Camera scan UI, capture evidence metadata, estimation APIs, callback, fusion math, verification photo context, docs, benchmark script, worker.
