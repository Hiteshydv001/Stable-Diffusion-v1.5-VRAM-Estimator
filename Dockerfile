# FastAPI backend container for Render or other Docker-friendly platforms
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency file first for layer caching
COPY vram_estimator/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY vram_estimator ./vram_estimator

# Ensure the source package is on PYTHONPATH
ENV PYTHONPATH="/app/vram_estimator:${PYTHONPATH}"

EXPOSE 8000

# Start the FastAPI app with uvicorn when the container launches
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "vram_estimator"]
