import asyncio

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import Principal
from app.evaluation.study import run_study
from app.main import create_app

STUDENT = Principal(user_id="student-1", email="amina@example.edu", role="student", full_name="Amina")
ADMIN = Principal(user_id="admin-1", email="desk@example.edu", role="admin", full_name="Duty")
CONFIGURED = Settings(supabase_url="https://librimind.supabase.co", supabase_anon_key="anon-key")


def test_the_study_scores_three_workflows_from_the_runs() -> None:
    result = asyncio.run(run_study())
    assert result["tasks"] == 7
    assert [row["name"] for row in result["workflows"]] == ["baseline", "single-agent", "multi-agent"]
    for row in result["workflows"]:
        assert row["completed"] == sum(task["completed"] for task in row["tasks"])
        assert row["toolMatches"] == sum(task["toolMatch"] for task in row["tasks"])
        assert row["policyPasses"] == sum(task["policyPass"] for task in row["tasks"])
        assert row["elapsedMs"] == sum(task["elapsedMs"] for task in row["tasks"])
        assert row["elapsedMs"] >= 0
        assert len(row["tasks"]) == 7
    baseline, single, multi = result["workflows"]
    assert baseline["verificationTasks"] == 0
    assert single["verificationTasks"] == 0
    assert multi["verificationTasks"] == 7
    assert multi["verificationMatches"] == sum(bool(task["verificationMatch"]) for task in multi["tasks"])
    for row in (baseline, single, multi):
        assert row["completed"] == 7
        assert row["toolMatches"] == 7
        assert row["policyPasses"] == 7
    assert multi["verificationMatches"] == 7


def test_a_student_cannot_run_the_study() -> None:
    async def resolve(token: str, settings: Settings) -> Principal:
        return STUDENT if token == "student-token" else ADMIN

    async def save(token: str, user_id: str, payload: dict, settings: Settings) -> dict:
        return payload

    client = TestClient(create_app(CONFIGURED, resolve, save))
    denied = client.post("/api/v1/evaluation", headers={"Authorization": "Bearer student-token"})
    assert denied.status_code == 403
    allowed = client.post("/api/v1/evaluation", headers={"Authorization": "Bearer admin-token"})
    assert allowed.status_code == 200
    assert allowed.json()["tasks"] == 7
