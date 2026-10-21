"""Turns uploaded files into page-tagged text chunks."""

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Chunk:
    text: str
    page: int | None


def extract_pages(path: Path) -> list[tuple[int | None, str]]:
    """Returns (page number, text) pairs. Non-paginated formats yield a single entry with page None."""
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(path)
        return [(number, page.extract_text() or "") for number, page in enumerate(reader.pages, start=1)]
    if suffix == ".docx":
        import docx

        document = docx.Document(str(path))
        return [(None, "\n\n".join(paragraph.text for paragraph in document.paragraphs))]
    return [(None, path.read_text(encoding="utf-8", errors="replace"))]


def clean(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\x00", "")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # re-join words hyphenated across lines
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)  # single newlines are PDF line wraps, not paragraphs
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_text(text: str, size: int, overlap: int) -> list[str]:
    """Packs paragraphs (then sentences, then raw slices) into chunks of at most `size` characters,
    repeating the last `overlap` characters of a chunk at the start of the next."""
    pieces: list[str] = []
    for paragraph in text.split("\n\n"):
        paragraph = paragraph.strip()
        if len(paragraph) <= size:
            if paragraph:
                pieces.append(paragraph)
            continue
        for sentence in re.split(r"(?<=[.!?])\s+", paragraph):
            pieces.extend(sentence[i:i + size] for i in range(0, len(sentence), size))

    chunks: list[str] = []
    current = ""
    for piece in pieces:
        if current and len(current) + len(piece) + 1 > size:
            chunks.append(current)
            tail = current[-overlap:] if overlap else ""
            # Start the overlap on a word boundary.
            tail = tail[tail.find(" ") + 1:] if " " in tail else tail
            current = f"{tail} {piece}".strip() if len(tail) + len(piece) + 1 <= size else piece
        else:
            current = f"{current}\n{piece}" if current else piece
    if current:
        chunks.append(current)
    return chunks


def chunk_file(path: Path, size: int, overlap: int) -> tuple[list[Chunk], int | None]:
    """Returns the chunks and the page count (None for non-paginated files)."""
    pages = extract_pages(path)
    chunks = [
        Chunk(text, page)
        for page, raw in pages
        for text in split_text(clean(raw), size, overlap)
        if len(text) >= 20
    ]
    page_count = len(pages) if pages and pages[0][0] is not None else None
    return chunks, page_count
