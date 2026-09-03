FROM pytorch/pytorch:2.4.1-cuda12.4-cudnn9-runtime

ARG DEPTH_PRO_REV=9efe5c1def37a26c5367a71df664b18e1306c708
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEPTH_PRO_CHECKPOINT=/opt/depth-pro/checkpoints/depth_pro.pt

RUN apt-get update \
    && apt-get install -y --no-install-recommends git wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
RUN git clone https://github.com/apple/ml-depth-pro.git depth-pro \
    && cd depth-pro \
    && git checkout "$DEPTH_PRO_REV" \
    && mkdir -p checkpoints \
    && wget -q https://ml-site.cdn-apple.com/models/depth-pro/depth_pro.pt -O checkpoints/depth_pro.pt \
    && pip install --no-cache-dir -e .

COPY requirements.txt /opt/homelens/requirements.txt
RUN pip install --no-cache-dir -r /opt/homelens/requirements.txt
COPY app.py /opt/homelens/app.py

WORKDIR /opt/depth-pro
EXPOSE 8000
CMD ["uvicorn", "--app-dir", "/opt/homelens", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

