import pytest

from app.services.files import FileError, checksum, duplicate_title, validate_pdf


def test_a_pdf_header_is_accepted_and_other_files_are_not() -> None:
    validate_pdf(b"%PDF-1.7\n", "essay.pdf")
    with pytest.raises(FileError):
        validate_pdf(b"not a pdf", "notes.pdf")
    with pytest.raises(FileError):
        validate_pdf(b"%PDF-1.7\n", "notes.txt")


def test_checksum_is_stable_and_a_repeated_title_is_a_warning() -> None:
    assert checksum(b"%PDF-1.7") == checksum(b"%PDF-1.7")
    assert duplicate_title(["The Republic"], "  the   republic ")
    assert duplicate_title(["Meditations"], "The Republic") is None
