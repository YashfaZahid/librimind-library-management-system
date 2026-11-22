from app.services.covers import _cover_from_docs, cover_for_isbn, cover_for_url


def test_gutenberg_and_archive_covers() -> None:
    assert cover_for_url("https://www.gutenberg.org/files/1342/1342-pdf.pdf") == (
        "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg"
    )
    assert cover_for_url("https://www.gutenberg.org/cache/epub/1342/pg1342-images.epub") == (
        "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg"
    )
    assert cover_for_url("https://archive.org/download/theodyssey/theodyssey.pdf") == (
        "https://archive.org/services/img/theodyssey"
    )
    assert cover_for_url("https://example.edu/notes.pdf") == ""


def test_a_close_title_supplies_the_cover() -> None:
    docs = [
        {"title": "A Journey", "cover_i": 1},
        {"title": "The Journey to the West, Volume 1", "cover_i": 240726},
    ]
    assert _cover_from_docs(docs, "journey to the west") == "https://covers.openlibrary.org/b/id/240726-L.jpg"
    assert _cover_from_docs([{"title": "Meditations", "isbn": ["9780140449334"]}], "meditations") == (
        "https://covers.openlibrary.org/b/isbn/9780140449334-L.jpg"
    )


def test_isbn_cover_uses_open_library() -> None:
    assert cover_for_isbn("978-0-14-143951-8") == "https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg"
    assert cover_for_isbn("not-an-isbn") == ""
