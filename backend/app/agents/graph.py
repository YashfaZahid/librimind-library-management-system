import time
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.intent import classify
from app.agents.tools import LibraryTools


class AgentState(TypedDict):
    request: str
    intent: str
    answer: str
    claims: dict[str, Any]
    error: str
    verified: bool
    verification: str


def build_graph(tools: LibraryTools):
    async def orchestrate(state: AgentState) -> dict:
        started = time.perf_counter()
        intent = classify(state["request"])
        await tools.record("orchestrator", "route", True, {"summary": intent, "intent": intent}, started)
        return {"intent": intent}

    async def search(state: AgentState) -> dict:
        return await tools.search(state["request"])

    async def metadata(state: AgentState) -> dict:
        return await tools.metadata(state["request"])

    async def recommend(state: AgentState) -> dict:
        return await tools.recommend()

    async def similar(state: AgentState) -> dict:
        return await tools.similar(state["request"])

    async def circulation(state: AgentState) -> dict:
        return await tools.circulate(state["request"])

    async def inventory(state: AgentState) -> dict:
        return await tools.inventory()

    async def verify(state: AgentState) -> dict:
        if state.get("error"):
            started = time.perf_counter()
            await tools.record("verification", "reread", False, {"summary": "The earlier step failed, so nothing was confirmed."}, started)
            return {"verified": False, "verification": "The earlier step failed, so nothing was confirmed."}
        result = await tools.verify(state.get("claims") or {})
        return {"verified": result["ok"], "verification": result["reason"]}

    async def answer(state: AgentState) -> dict:
        if state.get("error"):
            return {}
        if not state.get("verified"):
            return {"answer": state.get("verification") or "That result did not hold when it was read back."}
        return {}

    def route(state: AgentState) -> str:
        return state["intent"]

    graph = StateGraph(AgentState)
    graph.add_node("orchestrator", orchestrate)
    graph.add_node("search", search)
    graph.add_node("metadata", metadata)
    graph.add_node("recommendation", recommend)
    graph.add_node("similar", similar)
    graph.add_node("circulation", circulation)
    graph.add_node("inventory", inventory)
    graph.add_node("verify", verify)
    graph.add_node("answer", answer)
    graph.add_edge(START, "orchestrator")
    graph.add_conditional_edges(
        "orchestrator",
        route,
        {
            "search": "search",
            "metadata": "metadata",
            "recommendation": "recommendation",
            "similar": "similar",
            "circulation": "circulation",
            "inventory": "inventory",
        },
    )
    for name in ("search", "metadata", "recommendation", "similar", "circulation", "inventory"):
        graph.add_edge(name, "verify")
    graph.add_edge("verify", "answer")
    graph.add_edge("answer", END)
    return graph.compile()
