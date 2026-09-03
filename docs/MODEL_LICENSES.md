# Model licenses

## Apple Depth Pro

- Repository: <https://github.com/apple/ml-depth-pro>
- Pinned source revision: `9efe5c1def37a26c5367a71df664b18e1306c708`
- Checkpoint source used by the worker image: `https://ml-site.cdn-apple.com/models/depth-pro/depth_pro.pt`
- License file: <https://github.com/apple/ml-depth-pro/blob/main/LICENSE>
- Acknowledgements: <https://github.com/apple/ml-depth-pro/blob/main/ACKNOWLEDGEMENTS.md>

Depth Pro uses Apple's repository license (Copyright (C) 2024 Apple Inc.), not MIT or Apache. Apple grants a personal, non-exclusive copyright license to use, reproduce, modify, and redistribute the software, with or without modifications, provided unmodified full redistributions retain the notice and disclaimers. The license does not grant patent rights, trademark rights, or a commercial warranty. The software is provided AS IS. `ACKNOWLEDGEMENTS.md` lists separately licensed subcomponents, including PyTorch Image Models (`timm`, Apache 2.0). This document is an engineering inventory, not legal advice. Legal review is required before commercialization.

## HomeLens structure and geometry

The current `depth-structure-heuristic-v1` and `ransac-room-geometry-v1` implementations are HomeLens code. They use deterministic image-region heuristics, metric back-projection, and RANSAC; there is no separately licensed structure model in version 1.

## Updating a model

Any model or checkpoint change must update this inventory, the pinned version constants, the worker image, stored provenance, and benchmark report. Do not silently reuse calibration evidence across materially different model versions.
