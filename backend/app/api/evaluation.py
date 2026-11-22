from fastapi import Depends, FastAPI, HTTPException

from app.core.security import Principal
from app.evaluation.study import run_study


def register_evaluation(app: FastAPI, principal) -> None:
    @app.post("/api/v1/evaluation")
    async def evaluation(user: Principal = Depends(principal)) -> dict:
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="Admin access is required.")
        return await run_study()
