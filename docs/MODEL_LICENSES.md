# Model licenses

## Apple Depth Pro

- Repository: <https://github.com/apple/ml-depth-pro>
- Pinned source revision: `9efe5c1def37a26c5367a71df664b18e1306c708`
- Checkpoint source used by the worker image: `https://ml-site.cdn-apple.com/models/depth-pro/depth_pro.pt`
- License file: <https://github.com/apple/ml-depth-pro/blob/main/LICENSE>
- Acknowledgements: <https://github.com/apple/ml-depth-pro/blob/main/ACKNOWLEDGEMENTS.md>

Depth Pro uses an Apple model/source license, not a blanket MIT or Apache license. The license grants specified copyright permissions subject to its conditions and explicitly does not grant patent rights. The acknowledgements list separately licensed components. Legal review of the exact source, checkpoint, dependencies, notices, distribution model, and intended commercial use is required before commercialization. This document is an engineering inventory, not legal advice.

## HomeLens structure and geometry

The current `depth-structure-heuristic-v1` and `ransac-room-geometry-v1` implementations are HomeLens code. They use deterministic image-region heuristics, metric back-projection, and RANSAC; there is no separately licensed structure model in version 1.

## Updating a model

Any model or checkpoint change must update this inventory, the pinned version constants, the worker image, stored provenance, and benchmark report. Do not silently reuse calibration evidence across materially different model versions.
