from datetime import datetime, timezone

from app.agents.graph import build_graph
from app.agents.openai_desk import SYSTEM, TOOLS, dispatch
from app.agents.tools import LibraryTools
from app.core.security import Principal
from app.db.gateway import Gateway
from app.services.discovery import DiscoveryService
from app.services.files import FileError


class AssistantService:
    def __init__(self, library: Gateway, trace: Gateway, discovery: DiscoveryService | None = None, model=None) -> None:
        self.library = library
        self.trace = trace
        self.discovery = discovery
        self.model = model

    async def ask(self, user: Principal, message: str) -> dict:
        text = " ".join(message.split())
        if len(text) < 2:
            raise FileError("Ask a longer question.")
        run = await self.trace.insert(
            "agent_runs",
            {
                "user_id": user.user_id,
                "workflow": "multi-agent",
                "status": "running",
                "request": text,
                "response": None,
                "error": None,
                "finished_at": None,
            },
        )
        tools = LibraryTools(self.library, self.trace, user, run["id"], self.discovery)
        try:
            if self.model is not None:
                final = await self._with_model(tools, text)
            else:
                final = await build_graph(tools).ainvoke(
                    {
                        "request": text,
                        "intent": "",
                        "answer": "",
                        "claims": {},
                        "error": "",
                        "verified": False,
                        "verification": "",
                    }
                )
        except FileError:
            await self.trace.update(
                "agent_runs",
                {"id": f"eq.{run['id']}"},
                {"status": "failed", "error": "The assistant stopped before it could answer.", "finished_at": _now()},
            )
            raise
        except Exception as exc:
            await self.trace.update(
                "agent_runs",
                {"id": f"eq.{run['id']}"},
                {"status": "failed", "error": "The assistant stopped before it could answer.", "finished_at": _now()},
            )
            raise FileError("The assistant stopped before it could answer.") from exc
        await self.trace.update(
            "agent_runs",
            {"id": f"eq.{run['id']}"},
            {
                "status": "succeeded",
                "response": final.get("answer") or "",
                "finished_at": _now(),
            },
        )
        return {
            "runId": run["id"],
            "response": final.get("answer") or "",
            "intent": final.get("intent") or "",
            "verified": bool(final.get("verified")),
            "events": tools.events,
        }

    async def _with_model(self, tools: LibraryTools, text: str) -> dict:
        messages: list[dict] = [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": text},
        ]
        claims: dict = {}
        intent = "library"
        answer = ""
        listed = ""
        for _ in range(4):
            turn = await self.model.reply(messages, TOOLS)
            calls = turn["tool_calls"]
            if not calls:
                answer = (turn["content"] or answer).strip()
                break
            messages.append(turn["raw"])
            for call in calls:
                intent = call["name"] or intent
                result = await dispatch(tools, call["name"], call["arguments"])
                for key, value in (result.get("claims") or {}).items():
                    if key == "book_ids":
                        claims.setdefault("book_ids", [])
                        claims["book_ids"].extend(value)
                    else:
                        claims[key] = value
                if result.get("answer"):
                    answer = result["answer"]
                    if "\n- " in answer:
                        listed = answer
                messages.append({"role": "tool", "tool_call_id": call["id"], "content": result.get("answer") or ""})
        if listed and "\n- " not in answer:
            answer = listed
        if not answer:
            answer = "I could not answer that from this library."
        checked = await tools.verify(claims)
        return {"answer": answer, "intent": intent, "verified": checked["ok"], "claims": claims}

    async def runs(self) -> list[dict]:
        rows = await self.library.select(
            "agent_runs",
            {"select": "id,workflow,status,request,response,started_at", "order": "started_at.desc"},
        )
        events = await self.library.select("agent_events", {"select": "run_id,agent,tool,success,latency_ms"})
        return [
            {
                "id": row["id"],
                "workflow": row.get("workflow") or "",
                "status": row.get("status") or "",
                "request": row.get("request") or "",
                "response": row.get("response") or "",
                "events": [
                    {
                        "agent": event["agent"],
                        "tool": event["tool"],
                        "success": bool(event["success"]),
                        "latencyMs": event.get("latency_ms") or 0,
                    }
                    for event in events
                    if event.get("run_id") == row["id"]
                ],
            }
            for row in rows
        ]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
