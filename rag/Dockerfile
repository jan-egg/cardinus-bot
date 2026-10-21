FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    EMBEDDING_CACHE_DIR=/models \
    RAG_DATA_DIR=/data

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Bake the embedding model into the image so the service starts without downloading it.
ARG EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
ENV EMBEDDING_MODEL=${EMBEDDING_MODEL}
RUN python -c "import os; from fastembed import TextEmbedding; TextEmbedding(os.environ['EMBEDDING_MODEL'], cache_dir='/models')"

COPY app ./app
RUN useradd --create-home app && mkdir -p /data && chown -R app /data /models
USER app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
