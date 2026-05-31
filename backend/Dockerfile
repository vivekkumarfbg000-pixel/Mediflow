# ── Mediflow FastAPI Backend – Docker Image ──────────────────────────────────
# Build:  docker build -t mediflow-backend .
# Run:    docker run -p 8000:8000 mediflow-backend

FROM python:3.11-slim

LABEL maintainer="Mediflow Team"
LABEL description="Mediflow AI backend – voice-scribe, OCR, lab-trend"

# System deps (Tesseract for OCR, ffmpeg for audio processing)
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        ffmpeg \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer-cache friendly)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Non-root user for security
RUN adduser --disabled-password --gecos "" mediflow

# Create tmp directory for file uploads and set ownership/permissions
RUN mkdir -p /app/tmp && chown -R mediflow:mediflow /app && chmod -R 777 /app/tmp

# Expose the API port
EXPOSE 8000

USER mediflow

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
