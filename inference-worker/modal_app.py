"""Deploy the existing FastAPI worker to Modal with a GPU.

Usage (from this directory, after `pip install modal` and `modal token new`):

    modal deploy modal_app.py
"""

from __future__ import annotations

from pathlib import Path

import modal

WORKER_DIR = Path(__file__).parent
DEPTH_PRO_REV = "9efe5c1def37a26c5367a71df664b18e1306c708"

image = (
    modal.Image.from_registry("pytorch/pytorch:2.4.1-cuda12.4-cudnn9-runtime")
    .apt_install("git", "wget")
    .run_commands(
        "git clone https://github.com/apple/ml-depth-pro.git /opt/depth-pro",
        f"cd /opt/depth-pro && git checkout {DEPTH_PRO_REV}",
        "mkdir -p /opt/depth-pro/checkpoints",
        "wget -q https://ml-site.cdn-apple.com/models/depth-pro/depth_pro.pt -O /opt/depth-pro/checkpoints/depth_pro.pt",
        "pip install --no-cache-dir -e /opt/depth-pro",
    )
    .pip_install_from_requirements(str(WORKER_DIR / "requirements.txt"))
    .env({"DEPTH_PRO_CHECKPOINT": "/opt/depth-pro/checkpoints/depth_pro.pt"})
    .add_local_file(str(WORKER_DIR / "app.py"), "/opt/homelens/app.py")
    .workdir("/opt/depth-pro")
)

app = modal.App("homelens-photo-metric")
secrets = modal.Secret.from_name("homelens-inference")


@app.function(
    image=image,
    gpu="A10G",
    timeout=900,
    scaledown_window=300,
    secrets=[secrets],
)
@modal.asgi_app()
def fastapi_app():
    import sys

    sys.path.insert(0, "/opt/homelens")
    from app import app as worker_app

    return worker_app
