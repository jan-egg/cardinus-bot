import hashlib
import re

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


class HashEmbedder:
    """Bag-of-words hashing embedder: deterministic, offline, good enough to rank keyword overlap."""

    dims = 256

    def _vector(self, text: str) -> list[float]:
        vector = [0.0] * self.dims
        for word in re.findall(r"[a-z]+", text.lower()):
            vector[int(hashlib.md5(word.encode()).hexdigest(), 16) % self.dims] += 1.0
        norm = sum(v * v for v in vector) ** 0.5 or 1.0
        return [v / norm for v in vector]

    def embed_passages(self, texts):
        return [self._vector(t) for t in texts]

    def embed_query(self, text):
        return self._vector(text)


class FakeLLM:
    model = "fake"
    status = "ready"

    def __init__(self):
        self.calls = []

    def chat(self, question, context):
        self.calls.append((question, context))
        return "Fireball deals 8d6 fire damage [1]."


@pytest.fixture
def setup(tmp_path):
    knowledge = tmp_path / "knowledge"
    knowledge.mkdir()
    (knowledge / "spells.md").write_text(
        "Fireball. A bright streak flashes to a point you choose and blossoms into flame. "
        "Each creature in a 20-foot radius takes 8d6 fire damage.\n\n"
        "Cure Wounds. A creature you touch regains hit points equal to 1d8 + your modifier."
    )
    settings = Settings(data_dir=tmp_path / "data", knowledge_dir=knowledge, api_key="secret")
    llm = FakeLLM()
    with TestClient(create_app(settings, HashEmbedder(), llm)) as client:
        client.app.state.kb.wait_idle()
        yield client, llm, knowledge


def auth(**kwargs):
    return {"headers": {"X-API-Key": "secret"}, **kwargs}


def test_requires_api_key(setup):
    client, _, _ = setup
    assert client.get("/documents").status_code == 401
    assert client.get("/health").status_code == 200


def test_knowledge_folder_is_indexed_on_startup(setup):
    client, _, _ = setup
    documents = client.get("/documents", **auth()).json()
    assert [(d["filename"], d["status"], d["origin"]) for d in documents] == [("spells.md", "ready", "folder")]


def test_upload_search_and_delete(setup):
    client, _, _ = setup
    content = b"Owlbear. A monstrous cross between a giant owl and a bear. Its beak and claws rend prey."
    response = client.post("/documents", **auth(files={"file": ("monsters.txt", content, "text/plain")}))
    assert response.status_code == 202
    document_id = response.json()["id"]
    client.app.state.kb.wait_idle()
    assert client.get(f"/documents/{document_id}", **auth()).json()["status"] == "ready"

    # Uploading identical content again returns the same document instead of duplicating it.
    again = client.post("/documents", **auth(files={"file": ("copy.txt", content, "text/plain")}))
    assert again.json()["id"] == document_id

    hits = client.post("/search", **auth(json={"question": "owlbear beak claws", "top_k": 1})).json()
    assert hits[0]["filename"] == "monsters.txt"

    assert client.delete(f"/documents/{document_id}", **auth()).status_code == 200
    hits = client.post("/search", **auth(json={"question": "owlbear beak claws"})).json()
    assert all(h["document_id"] != document_id for h in hits)


def test_rejects_unsupported_files(setup):
    client, _, _ = setup
    response = client.post("/documents", **auth(files={"file": ("map.png", b"\x89PNG", "image/png")}))
    assert response.status_code == 415


def test_query_passes_retrieved_context_to_the_model(setup):
    client, llm, _ = setup
    body = client.post("/query", **auth(json={"question": "How much damage does fireball deal?"})).json()
    assert body["answer"].startswith("Fireball deals")
    assert body["sources"][0]["filename"] == "spells.md"
    _, context = llm.calls[0]
    assert "8d6 fire damage" in context and context.startswith("[1] spells.md")


def test_query_reports_model_not_ready(setup):
    client, llm, _ = setup
    llm.status = "downloading"
    response = client.post("/query", **auth(json={"question": "fireball"}))
    assert response.status_code == 503


def test_sync_removes_documents_whose_file_was_deleted(setup):
    client, _, knowledge = setup
    (knowledge / "spells.md").unlink()
    (knowledge / "items.txt").write_text("Bag of Holding. This bag has an interior space considerably larger than its outside.")
    result = client.post("/documents/sync", **auth()).json()
    assert result == {"added": ["items.txt"], "removed": ["spells.md"]}
