from app.core.security import Principal
from app.db.gateway import Gateway
from app.services.files import FileError
from app.services.learning import MODEL_VERSION, demand, evaluate, forecast, popularity, rank_books, wording_search


class InsightService:
    def __init__(self, library: Gateway, trace: Gateway) -> None:
        self.library = library
        self.trace = trace

    async def recommendations(self, user: Principal) -> dict:
        books, categories, copies, loans, reservations, profiles = await self._load()
        del reservations
        interests = next((list(row.get("reading_interests") or []) for row in profiles if row["id"] == user.user_id), [])
        ranked = rank_books(books, categories, loans, copies, user.user_id, interests)
        for item in ranked:
            await self.trace.insert(
                "recommendation_logs",
                {
                    "user_id": user.user_id,
                    "book_id": item["bookId"],
                    "score": item["score"],
                    "explanation": item["explanation"],
                    "model_version": MODEL_VERSION,
                },
            )
        return {"modelVersion": MODEL_VERSION, "recommendations": ranked}

    async def wording(self, query: str) -> dict:
        books, categories, copies, loans, reservations, profiles = await self._load()
        del copies, loans, reservations, profiles
        return {"modelVersion": MODEL_VERSION, "results": wording_search(books, categories, query)}

    async def insights(self, user: Principal) -> dict:
        if user.role != "admin":
            raise FileError("Admin access is required.", status_code=403)
        books, categories, copies, loans, reservations, profiles = await self._load()
        return {
            "modelVersion": MODEL_VERSION,
            "popularity": popularity(books, copies, loans),
            "demand": demand(books, copies, loans, reservations),
            "forecast": forecast(books, copies, loans),
            "evaluation": evaluate(books, categories, loans, copies, profiles),
        }

    async def _load(self):
        books = await self.library.select("books", {"select": "id,title,authors,description,category_id"})
        categories = await self.library.select("categories", {"select": "id,name"})
        copies = await self.library.select("book_copies", {"select": "id,book_id,status"})
        loans = await self.library.select("loans", {"select": "id,copy_id,user_id,issued_at,returned_at"})
        reservations = await self.library.select("reservations", {"select": "id,book_id,user_id,status"})
        profiles = await self.library.select("profiles", {"select": "id,reading_interests"})
        return books, categories, copies, loans, reservations, profiles
