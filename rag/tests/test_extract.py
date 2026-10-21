from app.extract import clean, split_text


def test_clean_joins_hyphenated_and_wrapped_lines():
    assert clean("A fire-\nball spell\nhits hard.\n\n\n\nNext") == "A fireball spell hits hard.\n\nNext"


def test_split_text_respects_size_and_overlaps():
    text = "\n\n".join(f"Paragraph {i} " + "word " * 40 for i in range(10))
    chunks = split_text(text, size=500, overlap=100)
    assert len(chunks) > 1
    assert all(len(chunk) <= 500 for chunk in chunks)
    # The start of each chunk repeats the end of the previous one.
    for previous, current in zip(chunks, chunks[1:]):
        assert current.split()[0] in previous.split()[-25:]


def test_split_text_breaks_very_long_paragraphs():
    chunks = split_text("x" * 2500, size=1000, overlap=0)
    assert [len(c) for c in chunks] == [1000, 1000, 500]
