"""The knowledge base: a SQLite registry of documents plus a Chroma collection of their chunks."""

import hashlib
import logging
import queue
import shutil
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import chromadb

from .config import Settings
from .extract import chunk_file

log = logging.getLogger(__name__)

EMBED_BATCH = 64


class Embedder(Protocol):
    def embed_passages(self, texts: list[str]) -> list[list[float]]: ...
    def embed_query(self, text: str) -> list[float]: ...


class FastEmbedder:
    """Small CPU embedding model; downloaded once into the image at build time."""

    def __init__(self, model: str, cache_dir: str | None):
        from fastembed import TextEmbedding

        self.model = TextEmbedding(model_name=model, cache_dir=cache_dir)

    def embed_passages(self, texts: list[str]) -> list[list[float]]:
        return [vector.tolist() for vector in self.model.passage_embed(texts)]

    def embed_query(self, text: str) -> list[float]:
        return next(iter(self.model.query_embed(text))).tolist()


@dataclass
class Document:
    id: str
    filename: str
    status: str
    chunks: int
    pages: int | None
    error: str | None
    origin: str
    path: str


@dataclass
class Hit:
    document_id: str
    filename: str
    page: int | None
    text: str
    score: float


def file_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


class KnowledgeBase:
    def __init__(self, settings: Settings, embedder: Embedder):
        self.settings = settings
        self.embedder = embedder
        self.files_dir = settings.data_dir / "files"
        self.files_dir.mkdir(parents=True, exist_ok=True)

        self._db_lock = threading.Lock()
        self._db = sqlite3.connect(settings.data_dir / "registry.db", check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._db.execute(
            """CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY, filename TEXT NOT NULL, status TEXT NOT NULL,
                chunks INTEGER NOT NULL DEFAULT 0, pages INTEGER, error TEXT,
                origin TEXT NOT NULL, path TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"""
        )
        self._db.commit()

        chroma = chromadb.PersistentClient(
            path=str(settings.data_dir / "chroma"),
            settings=chromadb.Settings(anonymized_telemetry=False),
        )
        self.collection = chroma.get_or_create_collection(
            "dnd", embedding_function=None, configuration={"hnsw": {"space": "cosine"}}
        )

        self._jobs: queue.Queue[str] = queue.Queue()
        self._worker = threading.Thread(target=self._work, daemon=True, name="ingest")

    # --- registry -------------------------------------------------------------------------

    def _execute(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        with self._db_lock:
            rows = self._db.execute(sql, params).fetchall()
            self._db.commit()
            return rows

    def list_documents(self) -> list[Document]:
        rows = self._execute("SELECT * FROM documents ORDER BY filename COLLATE NOCASE")
        return [Document(**{k: row[k] for k in Document.__dataclass_fields__}) for row in rows]

    def get_document(self, document_id: str) -> Document | None:
        return next((d for d in self.list_documents() if d.id == document_id), None)

    # --- ingestion ------------------------------------------------------------------------

    def start(self) -> None:
        self._worker.start()
        # Re-queue anything interrupted by a restart.
        for document in self.list_documents():
            if document.status == "processing":
                self._jobs.put(document.id)
        if self.settings.knowledge_dir:
            self.sync_knowledge_dir()

    def add_upload(self, temp_path: Path, filename: str) -> Document:
        """Registers an uploaded file (already written to temp_path) and queues it for indexing.
        Uploading the same content twice returns the existing document."""
        document_id = file_digest(temp_path)[:12]
        existing = self.get_document(document_id)
        if existing:
            temp_path.unlink(missing_ok=True)
            return existing
        target = self.files_dir / f"{document_id}{Path(filename).suffix.lower()}"
        shutil.move(temp_path, target)
        return self._register(document_id, filename, "upload", target)

    def _register(self, document_id: str, filename: str, origin: str, path: Path) -> Document:
        self._execute(
            "INSERT INTO documents (id, filename, status, origin, path) VALUES (?, ?, 'processing', ?, ?)",
            (document_id, filename, origin, str(path)),
        )
        self._jobs.put(document_id)
        return self.get_document(document_id)  # type: ignore[return-value]

    def sync_knowledge_dir(self) -> dict[str, list[str]]:
        """Indexes new files in the knowledge folder and drops documents whose file was removed."""
        folder = self.settings.knowledge_dir
        if not folder or not folder.is_dir():
            return {"added": [], "removed": []}
        added, seen = [], set()
        for path in sorted(folder.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in self.settings.supported_extensions:
                continue
            document_id = file_digest(path)[:12]
            seen.add(document_id)
            if not self.get_document(document_id):
                self._register(document_id, path.name, "folder", path)
                added.append(path.name)
        removed = []
        for document in self.list_documents():
            if document.origin == "folder" and document.id not in seen:
                self.delete(document.id)
                removed.append(document.filename)
        return {"added": added, "removed": removed}

    def _work(self) -> None:
        while True:
            document_id = self._jobs.get()
            try:
                self._ingest(document_id)
            except Exception as error:  # noqa: BLE001 - a bad file must not stop the worker
                log.exception("Indexing %s failed", document_id)
                self._execute("UPDATE documents SET status = 'failed', error = ? WHERE id = ?", (str(error)[:300], document_id))
            finally:
                self._jobs.task_done()

    def _ingest(self, document_id: str) -> None:
        document = self.get_document(document_id)
        if not document:
            return
        log.info("Indexing %s", document.filename)
        chunks, pages = chunk_file(Path(document.path), self.settings.chunk_size, self.settings.chunk_overlap)
        if not chunks:
            raise ValueError("no text found (scanned PDFs need OCR first)")

        self.collection.delete(where={"document_id": document_id})
        for start in range(0, len(chunks), EMBED_BATCH):
            batch = chunks[start:start + EMBED_BATCH]
            # The filename is embedded with each chunk so "in the Monster Manual" style questions match.
            vectors = self.embedder.embed_passages([f"{document.filename}\n{c.text}" for c in batch])
            self.collection.add(
                ids=[f"{document_id}:{start + i}" for i in range(len(batch))],
                embeddings=vectors,
                documents=[c.text for c in batch],
                metadatas=[
                    {"document_id": document_id, "filename": document.filename, **({"page": c.page} if c.page else {})}
                    for c in batch
                ],
            )
        self._execute(
            "UPDATE documents SET status = 'ready', chunks = ?, pages = ?, error = NULL WHERE id = ?",
            (len(chunks), pages, document_id),
        )
        log.info("Indexed %s: %d chunks", document.filename, len(chunks))

    def wait_idle(self) -> None:
        self._jobs.join()

    # --- removal and search ---------------------------------------------------------------

    def delete(self, document_id: str) -> bool:
        document = self.get_document(document_id)
        if not document:
            return False
        self.collection.delete(where={"document_id": document_id})
        self._execute("DELETE FROM documents WHERE id = ?", (document_id,))
        if document.origin == "upload":
            Path(document.path).unlink(missing_ok=True)
        return True

    def search(self, question: str, top_k: int) -> list[Hit]:
        if self.collection.count() == 0:
            return []
        result = self.collection.query(
            query_embeddings=[self.embedder.embed_query(question)],
            n_results=min(top_k, self.collection.count()),
            include=["documents", "metadatas", "distances"],
        )
        return [
            Hit(
                document_id=str(meta["document_id"]),
                filename=str(meta["filename"]),
                page=int(meta["page"]) if "page" in meta else None,
                text=text,
                score=round(1 - distance, 4),
            )
            for text, meta, distance in zip(result["documents"][0], result["metadatas"][0], result["distances"][0])
        ]
