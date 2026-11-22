import json

import httpx

from app.agents.tools import LibraryTools
from app.core.config import Settings
from app.services.files import FileError

SYSTEM = (
    "You are the desk assistant for one library, LibriMind. "
    "Answer only questions about this library: its books, copies, loans, reservations, fines, recommendations, and stock. "
    "If the question is not about this library, reply exactly: I only answer questions about this library. "
    "Use a tool before you state a title, a count, a due date, or a reservation. Do not invent records. "
    "When a tool returns a list, keep one title on each line and keep the availability it reported. "
    "To find titles similar to a book, call similar_titles. The library ranks the catalogue and returns only a short list. "
    "Mention only titles that tool returned. Do not ask for the rest of the catalogue."
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_library",
            "description": "Search this library catalogue by title, author, or words from the question.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "reserve_book",
            "description": "Place a reservation for a catalogue title.",
            "parameters": {
                "type": "object",
                "properties": {"title": {"type": "string"}},
                "required": ["title"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "my_account",
            "description": "Read the signed-in person's open loans and fines.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "similar_titles",
            "description": "Rank a short list of catalogue titles that are close in wording to one named book. The catalogue stays on the server.",
            "parameters": {
                "type": "object",
                "properties": {"title": {"type": "string"}},
                "required": ["title"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "recommend",
            "description": "Suggest a short list from this person's interests and loans. The library ranks the catalogue and returns only that list.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "stock",
            "description": "List titles in this library that have no available copy.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "describe_title",
            "description": "Read the catalogue record for a title, including its ISBN and duplicate titles.",
            "parameters": {
                "type": "object",
                "properties": {"title": {"type": "string"}},
                "required": ["title"],
                "additionalProperties": False,
            },
        },
    },
]


class OpenAIDesk:
    def __init__(self, settings: Settings) -> None:
        self.key = settings.llm_api_key.strip()
        self.base = settings.model_base
        self.model = settings.model_name

    async def reply(self, messages: list[dict], tools: list[dict]) -> dict:
        try:
            async with httpx.AsyncClient(timeout=40) as client:
                response = await client.post(
                    f"{self.base}/chat/completions",
                    headers={"Authorization": f"Bearer {self.key}"},
                    json={"model": self.model, "temperature": 0.2, "messages": messages, "tools": tools},
                )
        except httpx.HTTPError as exc:
            raise FileError("The model did not answer. Check LLM_API_KEY on the server.") from exc
        if response.status_code >= 400:
            raise FileError("The model did not answer. Check LLM_API_KEY on the server.")
        try:
            message = response.json()["choices"][0]["message"]
        except (KeyError, IndexError, ValueError) as exc:
            raise FileError("The model did not answer. Check LLM_API_KEY on the server.") from exc
        calls = []
        for call in message.get("tool_calls") or []:
            function = call.get("function") or {}
            raw = function.get("arguments") or "{}"
            try:
                arguments = json.loads(raw) if isinstance(raw, str) else dict(raw)
            except json.JSONDecodeError:
                arguments = {}
            calls.append({"id": call.get("id") or function.get("name") or "tool", "name": function.get("name") or "", "arguments": arguments})
        return {"content": message.get("content"), "tool_calls": calls, "raw": message}


async def dispatch(tools: LibraryTools, name: str, arguments: dict) -> dict:
    if name == "search_library":
        return await tools.search(str(arguments.get("query") or ""))
    if name == "reserve_book":
        return await tools.reserve_named(str(arguments.get("title") or ""))
    if name == "my_account":
        return await tools.circulate("what is due")
    if name == "similar_titles":
        return await tools.similar(str(arguments.get("title") or ""))
    if name == "recommend":
        return await tools.recommend()
    if name == "stock":
        return await tools.inventory()
    if name == "describe_title":
        return await tools.metadata(str(arguments.get("title") or ""))
    return {"answer": "That action is not available in this library.", "claims": {}, "error": "unknown tool"}
