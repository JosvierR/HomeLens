# Architecture

## Product modes

- **Demo** — anonymous, synthetic/local scan, no permanent Storage.
- **Product** — authenticated project, private evidence, asynchronous GPU inference, durable provenance, and learning from human correction.

## Production path

```text
Mobile Browser
     ↓
Real Camera
     ↓
Private Supabase Storage
     ↓
Nuxt / Nitro
     ↓
Signed Inference Request
     ↓
GPU Worker
     ↓
Metric Depth
     ↓
Structural Geometry
     ↓
Multi-View Fusion
     ↓
Measurement + Uncertainty
     ↓
Supabase Postgres
     ↓
Decision Confidence
     ↓
Next Best Capture / Scan Rescue
     ↓
Human Verification
     ↓
Error Atlas
```

Vercel/Nitro coordinates jobs but does not run the GPU model. The frontend never receives a depth array or an inference signed URL.

## Confidence and uncertainty

Each view-level confidence combines depth quality, structural confidence, plane-fit quality, image quality, camera distance, occlusion, and geometry completeness with a weighted geometric mean. Fusion then incorporates observation confidence, supporting-view count, and multi-view consistency. The displayed interval is the widest of within-view uncertainty, cross-view spread, and a confidence penalty. Historical Error Atlas evidence may calibrate the raw value; raw confidence is never overwritten.

This is an explicit heuristic confidence model until a real benchmark dataset is large enough for empirical calibration. Values are not certified measurements.

## Structural scope

Version 1 supports rectangular and near-rectangular rooms only. The structure provider uses transparent depth-region heuristics and plane consistency; it does not use a general vision-language model. A room that does not support a rectangular model is flagged instead of receiving forced width and length values. Opening detection is not yet reliable in the worker, so window and door counts remain an optional user correction before scenario analysis.

## Provider boundaries

- `MetricDepthProvider` — metric depth and focal information.
- `RoomStructureProvider` — floor, ceiling, walls, corners, vanishing points, and confidence.
- `RoomMeasurementProvider` — job-level contract used by HomeLens. The current remote worker is replaceable by future ARCore, RoomPlan, or other providers.

## Persistence and learning

Fused measurements store uncertainty and all model versions in queryable columns. `measurement_observations` keeps per-view scalar evidence. `image_inference_runs` records processing status and quality without depth maps. Human corrections preserve the original estimate and add photo-specific error context to `verification_evidence`.

## Deployment boundary

The `inference-worker/` image requires a CUDA-capable GPU host and the Depth Pro checkpoint. Deploy with `inference-worker/modal_app.py` or the Dockerfile. Configure the server-only worker URL, bearer token, callback secret, and public HTTPS application URL. The worker downloads only short-lived private objects, processes them in memory, and discards source images and depth arrays after each job.
