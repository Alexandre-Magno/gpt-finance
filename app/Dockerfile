# Dockerfile for Backend (FastAPI)
FROM python:3.13-slim

# uv no lugar do pip: resolve e instala em segundos
COPY --from=ghcr.io/astral-sh/uv:0.12.3 /uv /bin/uv
ENV UV_LINK_MODE=copy

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    EMBEDDER_CACHE_DIR=/tmp/vector

# Só as deps que app/ importa. A ingestão (torch, sec-api, hdbscan) usa
# requirements.txt e roda no host — instalá-la aqui somaria ~2.5GB ao build.
COPY requirements-api.txt .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system -r requirements-api.txt

# Copy and run model download script
COPY utils/download_models.py /tmp/download_models.py
RUN python /tmp/download_models.py && rm /tmp/download_models.py

# Copy application code. Em producao nao ha bind mount por cima, entao os
# modelos baixados acima em /tmp/vector sao os efetivamente usados.
# ingestion/ entra so por causa de create-collection.py, que o servico
# init-collection roda com este mesmo image (usa apenas qdrant-client).
COPY app/ ./app/
COPY utils/ ./utils/
COPY ingestion/ ./ingestion/

# Expose port
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

# Command to start the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
