# Dockerfile for Backend (FastAPI)
FROM python:3.13-slim

# uv no lugar do pip: resolve e instala em segundos
COPY --from=ghcr.io/astral-sh/uv:0.12.3 /uv /bin/uv
ENV UV_LINK_MODE=copy

WORKDIR /app

# Só as deps que app/ importa. A ingestão (torch, sec-api, hdbscan) usa
# requirements.txt e roda no host — instalá-la aqui somaria ~2.5GB ao build.
COPY requirements-api.txt .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system -r requirements-api.txt

# Copy and run model download script
COPY utils/download_models.py /tmp/download_models.py
RUN python /tmp/download_models.py && rm /tmp/download_models.py

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Command to start the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
