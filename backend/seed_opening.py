"""Place the opening collection on the shelves. Safe to run again."""

import httpx

from app.core.config import Settings

CATEGORIES = {
    "design": "11111111-1111-4111-8111-111111111101",
    "computing": "11111111-1111-4111-8111-111111111102",
    "literature": "11111111-1111-4111-8111-111111111103",
    "history": "11111111-1111-4111-8111-111111111104",
    "philosophy": "11111111-1111-4111-8111-111111111105",
}

BOOKS = [
    ("The Grammar of Ornament", ["Owen Jones"], "design", "9780486254634", 1856, "A source book of pattern, drawn from buildings and objects across cultures.", 400),
    ("Flatland", ["Edwin A. Abbott"], "computing", "9780486272634", 1884, "A two-dimensional world used to think about dimension, form, and point of view.", 96),
    ("Pride and Prejudice", ["Jane Austen"], "literature", "9780141439518", 1813, "A novel of marriage, money, and the slow correction of a first impression.", 480),
    ("Frankenstein", ["Mary Shelley"], "literature", "9780141439471", 1818, "A scientist makes a living creature and then refuses the responsibility that follows.", 288),
    ("A Tale of Two Cities", ["Charles Dickens"], "literature", "9780141439600", 1859, "London and Paris through the years of the French Revolution.", 448),
    ("The Odyssey", ["Homer"], "literature", "9780140268867", -800, "The long voyage home after the war at Troy.", 416),
    ("The Histories", ["Herodotus"], "history", "9780140449082", -430, "An early inquiry into the wars between Greece and Persia, and the lands around them.", 736),
    ("History of the Peloponnesian War", ["Thucydides"], "history", "9780140440393", -400, "Athens and Sparta, told by a writer who watched the war.", 656),
    ("The Republic", ["Plato"], "philosophy", "9780140449143", -375, "A dialogue on justice, the city, and the education of its guardians.", 416),
    ("Meditations", ["Marcus Aurelius"], "philosophy", "9780140449334", 180, "Private notes on how to act when the day does not go as planned.", 304),
    ("The Prince", ["Niccolò Machiavelli"], "philosophy", "9780140449150", 1532, "A short book on how a ruler keeps a state.", 128),
    ("Nicomachean Ethics", ["Aristotle"], "philosophy", "9780140449495", -340, "An account of virtue, habit, and a life that is worth choosing.", 400),
]


def main() -> None:
    settings = Settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise SystemExit("Supabase is not configured.")
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    base = settings.supabase_url.rstrip("/") + "/rest/v1"
    with httpx.Client(timeout=30) as client:
        current = client.get(f"{base}/books", params={"select": "isbn13"}, headers=headers)
        current.raise_for_status()
        owned = {row.get("isbn13") for row in current.json()}
        added = 0
        for index, (title, authors, subject, isbn, year, description, pages) in enumerate(BOOKS, start=1):
            if isbn in owned:
                continue
            saved = client.post(
                f"{base}/books",
                headers={**headers, "Prefer": "return=representation"},
                json={
                    "title": title,
                    "authors": authors,
                    "category_id": CATEGORIES[subject],
                    "isbn13": isbn,
                    "description": description,
                    "publication_year": year if year > 0 else None,
                    "publisher": "Public-domain edition",
                    "page_count": pages,
                    "cover_path": f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg",
                },
            )
            saved.raise_for_status()
            book_id = saved.json()[0]["id"]
            copy = client.post(
                f"{base}/book_copies",
                headers=headers,
                json={"book_id": book_id, "accession": f"LM-{index:04d}", "status": "available"},
            )
            copy.raise_for_status()
            added += 1
        print(f"Added {added} titles.")


if __name__ == "__main__":
    main()
