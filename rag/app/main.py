import logging
import secrets
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Security, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

from .config import Settings
from .knowledge import Document, Embedder, FastEmbedder, KnowledgeBase
from .llm import OllamaClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


class DocumentOut(BaseModel):
    id: str
    filename: str
    status: str
    chunks: int
    pages: int | None
    error: str | None
    origin: str

    @classmethod
    def of(cls, document: Document) -> "DocumentOut":
        return cls(**{name: getattr(document, name) for name in cls.model_fields})


class QueryIn(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int | None = Field(default=None, ge=1, le=20)


class SourceOut(BaseModel):
    n: int
    document_id: str
    filename: str
    page: int | None
    score: float
    excerpt: str


class AnswerOut(BaseModel):
    answer: str
    sources: list[SourceOut]




def create_app(settings: Settings | None = None, embedder: Embedder | None = None, llm: OllamaClient | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        app.state.kb = KnowledgeBase(settings, embedder or FastEmbedder(settings.embedding_model, settings.embedding_cache_dir))
        app.state.llm = llm or OllamaClient(settings.ollama_url, settings.ollama_model, settings.ollama_context)
        if llm is None:
            app.state.llm.ensure_model_async(settings.ollama_pull)
        app.state.kb.start()
        yield

    app = FastAPI(
        title="Cardinus D&D knowledge base",
        description="Upload rulebooks and notes, then ask questions answered from them.",
        lifespan=lifespan,
    )
    api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

    def authorize(key: str | None = Security(api_key_header)) -> None:
        if settings.api_key and not (key and secrets.compare_digest(key, settings.api_key)):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing X-API-Key")

    def kb() -> KnowledgeBase:
        return app.state.kb

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok", "llm": app.state.llm.status, "model": app.state.llm.model}

    @app.get("/documents", dependencies=[Depends(authorize)])
    def list_documents(base: KnowledgeBase = Depends(kb)) -> list[DocumentOut]:
        return [DocumentOut.of(d) for d in base.list_documents()]

    @app.post("/documents", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(authorize)])
    async def upload_document(file: UploadFile, base: KnowledgeBase = Depends(kb)) -> DocumentOut:
        """Adds a PDF, Markdown, text or Word file. Indexing runs in the background:
        poll `GET /documents/{id}` until its status is `ready`."""
        filename = Path(file.filename or "upload").name
        if Path(filename).suffix.lower() not in settings.supported_extensions:
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"Supported types: {', '.join(settings.supported_extensions)}")

        limit = settings.max_upload_mb * 1024 * 1024
        size = 0
        with tempfile.NamedTemporaryFile(dir=settings.data_dir, delete=False) as temp:
            while block := await file.read(1 << 20):
                size += len(block)
                if size > limit:
                    temp.close()
                    Path(temp.name).unlink()
                    raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Files are limited to {settings.max_upload_mb} MB")
                temp.write(block)
        document = await run_in_threadpool(base.add_upload, Path(temp.name), filename)
        return DocumentOut.of(document)

    @app.get("/documents/{document_id}", dependencies=[Depends(authorize)])
    def get_document(document_id: str, base: KnowledgeBase = Depends(kb)) -> DocumentOut:
        document = base.get_document(document_id)
        if not document:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No document with that id")
        return DocumentOut.of(document)

    @app.delete("/documents/{document_id}", dependencies=[Depends(authorize)])
    def delete_document(document_id: str, base: KnowledgeBase = Depends(kb)) -> dict:
        document = base.get_document(document_id)
        if not document:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No document with that id")
        base.delete(document_id)
        note = " It is in the knowledge folder, so delete the file there too or it comes back on the next sync." if document.origin == "folder" else ""
        return {"deleted": document_id, "note": note.strip()}

    @app.post("/documents/sync", dependencies=[Depends(authorize)])
    def sync_folder(base: KnowledgeBase = Depends(kb)) -> dict:
        """Indexes new files in the knowledge folder and removes documents whose file is gone."""
        if not settings.knowledge_dir:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No knowledge folder is configured (RAG_KNOWLEDGE_DIR)")
        return base.sync_knowledge_dir()

    @app.post("/search", dependencies=[Depends(authorize)])
    def search(body: QueryIn, base: KnowledgeBase = Depends(kb)) -> list[SourceOut]:
        """Retrieval only, without the language model. Useful for checking what the bot will see."""
        hits = base.search(body.question, body.top_k or settings.top_k)
        return [SourceOut(n=i, document_id=h.document_id, filename=h.filename, page=h.page, score=h.score, excerpt=h.text)
                for i, h in enumerate(hits, start=1)]

    @app.post("/query", dependencies=[Depends(authorize)])
    def query(body: QueryIn, base: KnowledgeBase = Depends(kb)) -> AnswerOut:
        """Answers a question from the most relevant passages, citing them as [n]."""
        llm_client: OllamaClient = app.state.llm
        if llm_client.status != "ready":
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                                f"The AI model ({llm_client.model}) is not ready yet: {llm_client.status}")
        hits = base.search(body.question, body.top_k or settings.top_k)
        if not hits:
            return AnswerOut(answer="The knowledge base is empty. Upload some D&D sources first.", sources=[])

        context = "\n\n".join(
            f"[{i}] {h.filename}{f', page {h.page}' if h.page else ''}\n{h.text}" for i, h in enumerate(hits, start=1)
        )
        try:
            answer = llm_client.chat(body.question, context)
        except Exception as error:  # noqa: BLE001
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"The AI model failed to answer: {error}") from error
        sources = [SourceOut(n=i, document_id=h.document_id, filename=h.filename, page=h.page, score=h.score, excerpt=h.text[:300])
                   for i, h in enumerate(hits, start=1)]
        return AnswerOut(answer=answer, sources=sources)

    return app


app = create_app()
