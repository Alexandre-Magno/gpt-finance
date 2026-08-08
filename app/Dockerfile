# Dockerfile for Backend (FastAPI)
FROM python:3.13-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    EMBEDDER_CACHE_DIR=/tmp/vector

# Install system dependencies if needed
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy and run model download script
COPY utils/download_models.py /tmp/download_models.py
RUN python /tmp/download_models.py && rm /tmp/download_models.py

# Copy application code. Em producao nao ha bind mount por cima, entao os
# modelos baixados acima em /tmp/vector sao os efetivamente usados.
COPY app/ ./app/
COPY utils/ ./utils/
COPY ingestion/ ./ingestion/

# Expose port
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

# Command to start the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
