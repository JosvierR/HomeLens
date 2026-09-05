"""HomeLens GPU worker: private RGB images -> depth -> conservative geometry observations.

The worker never logs signed image URLs and never retains source images or depth
arrays after a job. It emits no room dimension unless the associated plane/depth
checks produce a supported observation.
"""

from __future__ import annotations

import hashlib
import hmac
import io
import json
import math
import os
import time
from datetime import datetime, timezone
from typing import Literal

import httpx
import numpy as np
import torch
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from PIL import Image, ImageOps
from pydantic import BaseModel, ConfigDict, Field, HttpUrl

import depth_pro

DEPTH_VERSION = "depth-pro-0.1-9efe5c1"
STRUCTURE_VERSION = "depth-structure-heuristic-v1"
GEOMETRY_VERSION = "ransac-room-geometry-v1"
MEASUREMENT_VERSION = "photo-geometry-v1"
MAX_IMAGE_BYTES = 8 * 1024 * 1024

app = FastAPI(title="HomeLens Photo Metric Worker", version="1.0.0")
_model = None
_transform = None


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CaptureMetadata(StrictModel):
    captureId: str
    capturedAt: datetime
    widthPx: int = Field(gt=0, le=8192)
    heightPx: int = Field(gt=0, le=8192)
    orientation: Literal["portrait", "landscape", "square"]
    deviceFamily: str
    cameraIdHash: str | None = None
    facingMode: str | None = None
    focalLength35mm: float | None = Field(default=None, gt=0)
    estimatedFocalLengthPx: float | None = Field(default=None, gt=0)
    captureTarget: str
    brightnessScore: float = Field(ge=0, le=1)
    sharpnessScore: float = Field(ge=0, le=1)
    contrastScore: float = Field(ge=0, le=1)
    qualityBucket: Literal["good", "usable", "recapture_recommended"]


class EvidenceInput(StrictModel):
    evidenceId: str
    signedImageUrl: HttpUrl
    metadata: CaptureMetadata


class JobRequest(StrictModel):
    jobId: str
    scanId: str
    callbackUrl: HttpUrl
    evidence: list[EvidenceInput] = Field(min_length=3, max_length=20)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def require_worker_token(authorization: str | None) -> None:
    expected = os.environ.get("INFERENCE_API_TOKEN", "")
    received = authorization.removeprefix("Bearer ") if authorization else ""
    if not expected or not hmac.compare_digest(expected, received):
        raise HTTPException(status_code=401, detail="Unauthorized")


def load_model():
    global _model, _transform
    if _model is None:
        _model, _transform = depth_pro.create_model_and_transforms()
        _model = _model.to("cuda" if torch.cuda.is_available() else "cpu").eval()
    return _model, _transform


def back_project(depth: np.ndarray, focal_px: float, mask: np.ndarray, stride: int = 12) -> np.ndarray:
    height, width = depth.shape
    ys, xs = np.mgrid[0:height:stride, 0:width:stride]
    sampled_depth = depth[::stride, ::stride]
    selected = mask[::stride, ::stride] & np.isfinite(sampled_depth) & (sampled_depth > 0.1) & (sampled_depth < 30)
    z = sampled_depth[selected]
    x = (xs[selected] - width / 2) * z / focal_px
    y = (ys[selected] - height / 2) * z / focal_px
    return np.column_stack((x, y, z))


def plane_from_three(points: np.ndarray):
    normal = np.cross(points[1] - points[0], points[2] - points[0])
    norm = np.linalg.norm(normal)
    if norm < 1e-8:
        return None
    normal = normal / norm
    return normal, -float(np.dot(normal, points[0]))


def ransac_plane(points: np.ndarray, seed: int, threshold: float = 0.055, iterations: int = 180):
    if len(points) < 30:
        return None
    rng = np.random.default_rng(seed)
    best = None
    for _ in range(iterations):
        candidate = plane_from_three(points[rng.choice(len(points), 3, replace=False)])
        if candidate is None:
            continue
        normal, offset = candidate
        distances = np.abs(points @ normal + offset)
        inliers = distances <= threshold
        count = int(inliers.sum())
        if count < 25:
            continue
        residual = float(distances[inliers].mean())
        if best is None or count > best[2] or (count == best[2] and residual < best[3]):
            best = (normal, offset, count, residual, inliers)
    return best


def parallel_distance(first, second):
    if first is None or second is None:
        return None
    alignment = float(np.dot(first[0], second[0]))
    if abs(alignment) < 0.94:
        return None
    second_offset = -second[1] if alignment < 0 else second[1]
    return abs(first[1] - second_offset)


def plane_payload(evidence_id: str, kind: str, plane):
    if plane is None:
        return None
    normal, offset, count, residual, _ = plane
    residual_quality = max(0.0, 1.0 - residual / 0.055)
    confidence = min(1.0, count / 250 * 0.65 + residual_quality * 0.35)
    return {
        "evidenceId": evidence_id,
        "kind": kind,
        "normal": [float(value) for value in normal],
        "offset": float(offset),
        "inlierCount": count,
        "residualErrorMeters": residual,
        "confidence": confidence,
        "modelVersion": GEOMETRY_VERSION,
    }


# Keep in lockstep with shared/measurement-uncertainty.ts
MAX_RELATIVE_HALF_WIDTH = 0.29
MIN_RELATIVE_RANGE = 0.035
MAX_RELATIVE_RANGE = 0.28


def bounded_observation(evidence: EvidenceInput, kind: str, meters: float, residual_meters: float,
                        depth_quality: float, structure_quality: float, completeness: float,
                        extra_relative: float = 0.0):
    """Confidence is the inverse of the 90% relative half-width. No separate score."""
    if not math.isfinite(meters) or not 1.4 <= meters <= 30.0:
        return None
    if not math.isfinite(residual_meters) or residual_meters < 0:
        return None
    residual = residual_meters
    fit_quality = max(0.0, 1.0 - residual / 0.12)
    image_quality = min(1.0, (evidence.metadata.brightnessScore + evidence.metadata.sharpnessScore + evidence.metadata.contrastScore) / 3)
    relative_residual = residual / max(meters, 0.1)
    relative_quality = (
        (1.0 - depth_quality) * 0.10
        + (1.0 - structure_quality) * 0.06
        + (1.0 - image_quality) * 0.06
        + (1.0 - completeness) * 0.06
        + max(0.0, extra_relative)
    )
    relative_range = min(MAX_RELATIVE_RANGE, max(MIN_RELATIVE_RANGE, relative_residual * 1.8 + relative_quality))
    confidence = max(0.0, min(1.0, 1.0 - relative_range / MAX_RELATIVE_HALF_WIDTH))
    if confidence < 0.34:
        return None
    feet = meters * 3.280839895
    return {
        "evidenceId": evidence.evidenceId,
        "measurementType": kind,
        "estimatedValueFeet": feet,
        "confidence": confidence,
        "uncertaintyLowFeet": max(0.1, feet * (1 - relative_range)),
        "uncertaintyHighFeet": min(100.0, feet * (1 + relative_range)),
        "geometryFitErrorMeters": residual,
        "signals": {
            "depthQuality": depth_quality,
            "structuralConfidence": structure_quality,
            "geometryFitQuality": fit_quality,
            "imageQuality": image_quality,
            "distanceQuality": max(0.25, min(1.0, 1 - max(0, meters - 10) / 20)),
            "occlusionQuality": completeness,
            "geometryCompleteness": completeness,
        },
        "modelVersion": MEASUREMENT_VERSION,
        "createdAt": utc_now(),
    }


def infer_view(evidence: EvidenceInput):
    started = time.perf_counter()
    with httpx.Client(timeout=25.0, follow_redirects=True) as client:
        response = client.get(str(evidence.signedImageUrl))
        response.raise_for_status()
        if len(response.content) > MAX_IMAGE_BYTES:
            raise ValueError("Image exceeds the private evidence size limit")
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(response.content))).convert("RGB")
    # The source bytes and any EXIF live only in local function scope.
    model, transform = load_model()
    tensor = transform(image).to(next(model.parameters()).device)
    supplied_focal = evidence.metadata.estimatedFocalLengthPx
    with torch.inference_mode():
        prediction = model.infer(tensor, f_px=supplied_focal)
    depth = prediction["depth"].detach().float().cpu().numpy()
    focal = float(prediction["focallength_px"].detach().float().cpu())
    finite = np.isfinite(depth) & (depth > 0.1) & (depth < 50)
    if finite.mean() < 0.75:
        raise ValueError("Depth coverage is insufficient")
    min_depth, max_depth = [float(value) for value in np.percentile(depth[finite], [2, 98])]
    dynamic_quality = min(1.0, max(0.0, (max_depth - min_depth) / 5.0))
    depth_quality = min(1.0, float(finite.mean()) * 0.65 + dynamic_quality * 0.35)

    height, width = depth.shape
    yy, xx = np.mgrid[0:height, 0:width]
    masks = {
        "ceiling": yy < height * 0.30,
        "floor": yy > height * 0.62,
        "left_wall": xx < width * 0.27,
        "right_wall": xx > width * 0.73,
        "back_wall": (xx > width * 0.28) & (xx < width * 0.72) & (yy > height * 0.24) & (yy < height * 0.72),
    }
    seed = int(hashlib.sha256(evidence.evidenceId.encode()).hexdigest()[:8], 16)
    fits = {name: ransac_plane(back_project(depth, focal, mask), seed + index)
            for index, (name, mask) in enumerate(masks.items())}
    plane_results = [plane_payload(evidence.evidenceId, name, fit) for name, fit in fits.items()]
    plane_results = [item for item in plane_results if item is not None]
    structure_quality = min(1.0, len(plane_results) / 5)
    wall_alignment = abs(float(np.dot(fits["left_wall"][0], fits["right_wall"][0]))) if fits["left_wall"] and fits["right_wall"] else 0
    horizontal_alignment = abs(float(np.dot(fits["floor"][0], fits["ceiling"][0]))) if fits["floor"] and fits["ceiling"] else 0
    rectangularity = max(0.0, min(1.0, (wall_alignment + horizontal_alignment) / 2 * structure_quality))

    height_m = parallel_distance(fits["floor"], fits["ceiling"])
    width_m = parallel_distance(fits["left_wall"], fits["right_wall"])
    floor_points = back_project(depth, focal, masks["floor"])
    floor_residual = fits["floor"][3] if fits["floor"] else float("nan")
    left_residual = fits["left_wall"][3] if fits["left_wall"] else float("nan")
    length_m = float("nan")
    length_residual = floor_residual if math.isfinite(floor_residual) else 0.08
    length_extra = 0.0
    if len(floor_points) >= 20:
        zs = floor_points[:, 2]
        far = float(np.percentile(zs, 95))
        near = min(0.35, float(np.percentile(zs, 5)))
        length_m = far - near
        far_band = max(0.0, float(np.percentile(zs, 98) - np.percentile(zs, 90)))
        length_extra = far_band / max(length_m, 0.1)
    completeness = min(1.0, len(plane_results) / 4)
    observations = []
    for candidate in (
        bounded_observation(evidence, "height", height_m or float("nan"), floor_residual, depth_quality, structure_quality, completeness),
        bounded_observation(evidence, "width", width_m or float("nan"), left_residual, depth_quality, structure_quality, completeness),
        bounded_observation(evidence, "length", length_m, length_residual, depth_quality, structure_quality, completeness, length_extra),
    ):
        if candidate is not None:
            observations.append(candidate)

    created_at = utc_now()
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    depth_result = {
        "evidenceId": evidence.evidenceId,
        "modelName": "Apple Depth Pro",
        "modelVersion": DEPTH_VERSION,
        "depthMapReference": f"ephemeral://discarded/{evidence.evidenceId}",
        "estimatedFocalLengthPx": focal,
        "minDepthMeters": min_depth,
        "maxDepthMeters": max_depth,
        "processingTimeMs": elapsed_ms,
        "qualityScore": depth_quality,
        "confidence": depth_quality,
        "createdAt": created_at,
    }
    structure = {
        "evidenceId": evidence.evidenceId,
        "modelName": "Depth structural heuristics",
        "modelVersion": STRUCTURE_VERSION,
        "wallMaskReferences": [],
        "openingMaskReferences": [],
        "cornerPoints": [],
        "vanishingPoints": [],
        "floorConfidence": plane_payload(evidence.evidenceId, "floor", fits["floor"])["confidence"] if fits["floor"] else 0,
        "ceilingConfidence": plane_payload(evidence.evidenceId, "ceiling", fits["ceiling"])["confidence"] if fits["ceiling"] else 0,
        "wallConfidence": structure_quality,
        "openingConfidence": 0,
        "rectangularityConfidence": rectangularity,
        "qualityScore": structure_quality,
        "createdAt": created_at,
    }
    del depth, tensor, prediction, image
    return depth_result, structure, plane_results, observations


def signed_callback(payload: dict, callback_url: str) -> None:
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    secret = os.environ.get("INFERENCE_CALLBACK_SECRET", "")
    if not secret:
        raise RuntimeError("INFERENCE_CALLBACK_SECRET is not configured")
    signature = hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
    with httpx.Client(timeout=20.0) as client:
        response = client.post(callback_url, content=raw.encode(), headers={
            "content-type": "application/json",
            "x-homelens-signature": signature,
        })
        if response.is_error:
            # Inference already finished; do not discard GPU work because delivery failed once.
            print(
                f"callback_delivery_failed status={response.status_code} "
                f"jobId={payload.get('jobId')} scanId={payload.get('scanId')} "
                f"body={response.text[:200]}"
            )
            return
        response.raise_for_status()


def process_job(job: JobRequest) -> None:
    try:
        results = [infer_view(evidence) for evidence in job.evidence]
        depths = [item[0] for item in results]
        structures = [item[1] for item in results]
        planes = [plane for item in results for plane in item[2]]
        observations = [observation for item in results for observation in item[3]]
        types = {item["measurementType"] for item in observations}
        rectangularity = sum(item["rectangularityConfidence"] for item in structures) / len(structures)
        if rectangularity < 0.45:
            status = "irregular"
        elif {"width", "length", "height"}.issubset(types):
            status = "succeeded"
        elif types:
            status = "partial"
        else:
            status = "insufficient"
        payload = {
            "jobId": job.jobId,
            "scanId": job.scanId,
            "status": status,
            "depthResults": depths,
            "structureObservations": structures,
            "planeEstimates": planes,
            "measurementObservations": observations,
            "completedAt": utc_now(),
        }
    except Exception as error:
        payload = {
            "jobId": job.jobId,
            "scanId": job.scanId,
            "status": "failed",
            "depthResults": [],
            "structureObservations": [],
            "planeEstimates": [],
            "measurementObservations": [],
            "errorCode": "WORKER_INFERENCE_FAILED",
            "errorMessage": str(error)[:500],
            "completedAt": utc_now(),
        }
    print(
        f"job_complete jobId={job.jobId} status={payload['status']} "
        f"depths={len(payload.get('depthResults', []))} "
        f"observations={len(payload.get('measurementObservations', []))} "
        f"error={payload.get('errorCode')}"
    )
    if payload.get("depthResults"):
        sample = payload["depthResults"][0]
        print(
            f"depth_sample model={sample.get('modelVersion')} "
            f"focalPx={sample.get('estimatedFocalLengthPx')} "
            f"minM={sample.get('minDepthMeters')} maxM={sample.get('maxDepthMeters')} "
            f"quality={sample.get('qualityScore')} ms={sample.get('processingTimeMs')}"
        )
    signed_callback(payload, str(job.callbackUrl))


@app.get("/health")
def health():
    return {"ok": True, "gpu": torch.cuda.is_available(), "depthModelVersion": DEPTH_VERSION}


@app.post("/v1/jobs", status_code=202)
def create_job(job: JobRequest, background_tasks: BackgroundTasks, authorization: str | None = Header(default=None)):
    require_worker_token(authorization)
    background_tasks.add_task(process_job, job)
    return {"accepted": True, "jobId": job.jobId}

