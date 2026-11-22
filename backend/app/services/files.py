import hashlib
import re

MAX_PDF_BYTES = 20 * 1024 * 1024


class FileError(Exception):
    def __init__(self, detail: str, status_code: int = 400) -> None:
        self.detail = detail
        self.status_code = status_code


def checksum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate_pdf(data: bytes, filename: str) -> None:
    name = filename.strip().lower()
    if not name.endswith(".pdf"):
        raise FileError("Choose a PDF file.")
    if not data.startswith(b"%PDF-"):
        raise FileError("That file is not a valid PDF.")
    if len(data) > MAX_PDF_BYTES:
        raise FileError("A PDF must be 20 MB or smaller.")


def normalise_title(title: str) -> str:
    return re.sub(r"\s+", " ", title.casefold()).strip()


def duplicate_title(existing: list[str], title: str) -> str | None:
    needle = normalise_title(title)
    if not needle:
        return None
    for item in existing:
        if normalise_title(item) == needle:
            return "A title with this name is already in the library. Save it again only if this is a different file."
    return None


def safe_filename(title: str) -> str:
    cleaned = "".join(character if character.isalnum() or character in " -_" else "" for character in title).strip()
    return f"{cleaned or 'book'}.pdf"
