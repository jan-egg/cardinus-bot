import logging
import threading
import time

import httpx

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Cardinus, a Dungeons & Dragons assistant in a Discord server.
Answer the question using the numbered context passages from the group's rulebooks and notes.
- Cite the passages you use like [1] or [2][3].
- If the passages don't contain the answer, say so plainly. You may then add a short general
  answer from your own D&D knowledge, clearly labelled as not coming from their sources.
- Quote exact numbers (damage, ranges, DCs, spell slots) from the passages, don't guess them.
- Be concise: under 250 words unless the question needs a table or list. Use Discord markdown."""


class OllamaClient:
    def __init__(self, url: str, model: str, context: int):
        self.url = url.rstrip("/")
        self.model = model
        self.context = context
        self.status = "starting"

    def ensure_model_async(self, pull: bool) -> None:
        threading.Thread(target=self._ensure_model, args=(pull,), daemon=True, name="ollama-pull").start()

    def _ensure_model(self, pull: bool) -> None:
        try:
            tags = self._wait_for_server()
            names = {m["name"] for m in tags.get("models", [])}
            if self.model in names or f"{self.model}:latest" in names:
                self.status = "ready"
                return
            if not pull:
                self.status = f"model {self.model} is not installed in Ollama"
                return
            self.status = "downloading"
            log.info("Pulling %s into Ollama, this can take a while...", self.model)
            response = httpx.post(f"{self.url}/api/pull", json={"model": self.model, "stream": False}, timeout=None)
            response.raise_for_status()
            self.status = "ready"
            log.info("Model %s is ready", self.model)
        except Exception as error:  # noqa: BLE001 - report any failure through /health
            self.status = f"error: {error}"
            log.error("Could not prepare Ollama model %s: %s", self.model, error)

    def _wait_for_server(self, attempts: int = 30) -> dict:
        """Ollama may still be starting when this service boots, so retry for a while."""
        for attempt in range(attempts):
            try:
                return httpx.get(f"{self.url}/api/tags", timeout=30).json()
            except httpx.TransportError:
                if attempt == attempts - 1:
                    raise
                self.status = f"waiting for Ollama at {self.url}"
                time.sleep(5)
        raise AssertionError("unreachable")

    def chat(self, question: str, context: str) -> str:
        response = httpx.post(
            f"{self.url}/api/chat",
            json={
                "model": self.model,
                "stream": False,
                "keep_alive": "30m",
                "options": {"num_ctx": self.context, "temperature": 0.2},
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Context passages:\n\n{context}\n\nQuestion: {question}"},
                ],
            },
            timeout=httpx.Timeout(600, connect=10),
        )
        response.raise_for_status()
        return response.json()["message"]["content"].strip()
