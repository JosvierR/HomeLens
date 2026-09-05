"""Stdlib checks for worker request/response contracts. Does not load Depth Pro."""
from __future__ import annotations

import json
import unittest
from pathlib import Path


REQUIRED_JOB_KEYS = {"jobId", "scanId", "callbackUrl", "evidence"}
REQUIRED_CALLBACK_KEYS = {
    "jobId",
    "scanId",
    "status",
    "depthResults",
    "structureObservations",
    "planeEstimates",
    "measurementObservations",
    "completedAt",
}


class PayloadContractTests(unittest.TestCase):
    def test_example_job_contains_required_keys_and_no_public_depth_array(self) -> None:
        example = {
            "jobId": "a0c26fb1-40a8-44c5-877a-b0775ef93f27",
            "scanId": "3e473587-7153-466f-a1e6-58a2cf9cf9d8",
            "callbackUrl": "https://homelens.example/api/inference/photo-metric/callback",
            "evidence": [{"evidenceId": "e1", "signedImageUrl": "https://signed.example/x", "metadata": {}}],
        }
        self.assertTrue(REQUIRED_JOB_KEYS.issubset(example))
        self.assertGreaterEqual(len(example["evidence"]), 1)
        self.assertNotIn("depthMap", example)

    def test_failed_callback_requires_error_message_shape(self) -> None:
        payload = {
            "jobId": "a0c26fb1-40a8-44c5-877a-b0775ef93f27",
            "scanId": "3e473587-7153-466f-a1e6-58a2cf9cf9d8",
            "status": "failed",
            "depthResults": [],
            "structureObservations": [],
            "planeEstimates": [],
            "measurementObservations": [],
            "errorCode": "WORKER_INFERENCE_FAILED",
            "errorMessage": "Depth coverage is insufficient",
            "completedAt": "2026-09-03T12:00:00.000Z",
        }
        self.assertTrue(REQUIRED_CALLBACK_KEYS.issubset(payload))
        self.assertTrue(payload["errorMessage"])
        serialized = json.dumps(payload)
        self.assertNotIn("https://storage", serialized)

    def test_worker_source_never_claims_placeholder_dimensions(self) -> None:
        source = Path(__file__).with_name("app.py").read_text(encoding="utf8")
        self.assertNotIn("12.5", source)
        self.assertIn("insufficient", source)
        self.assertIn("MAX_RELATIVE_HALF_WIDTH", source)
        self.assertIn("1.0 - relative_range / MAX_RELATIVE_HALF_WIDTH", source)


if __name__ == "__main__":
    unittest.main()
