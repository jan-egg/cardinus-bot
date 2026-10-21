import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    data_dir: Path = Path(os.getenv("RAG_DATA_DIR", "/data"))
    knowledge_dir: Path | None = Path(os.environ["RAG_KNOWLEDGE_DIR"]) if os.getenv("RAG_KNOWLEDGE_DIR") else None
    api_key: str = os.getenv("RAG_API_KEY", "")
    max_upload_mb: int = int(os.getenv("RAG_MAX_UPLOAD_MB", "200"))

    embedding_model: str = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
    embedding_cache_dir: str | None = os.getenv("EMBEDDING_CACHE_DIR")
    chunk_size: int = int(os.getenv("RAG_CHUNK_SIZE", "1200"))
    chunk_overlap: int = int(os.getenv("RAG_CHUNK_OVERLAP", "200"))
    top_k: int = int(os.getenv("RAG_TOP_K", "6"))

    ollama_url: str = os.getenv("OLLAMA_URL", "http://ollama:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
    ollama_context: int = int(os.getenv("OLLAMA_CONTEXT", "8192"))
    ollama_pull: bool = os.getenv("OLLAMA_PULL", "true").lower() == "true"

    supported_extensions: tuple[str, ...] = field(default=(".pdf", ".md", ".markdown", ".txt", ".docx"))
