from typing import Literal

Role = Literal["student", "admin"]
Decision = Literal["allowed", "unauthenticated", "forbidden"]


def access_decision(role: str | None, area: Literal["member", "admin"]) -> Decision:
    """Students may use the library. Only an admin may use the desk."""
    if role is None:
        return "unauthenticated"
    if role not in ("student", "admin"):
        return "forbidden"
    if area == "admin" and role != "admin":
        return "forbidden"
    return "allowed"


def profile_write(full_name: str, programme: str | None, reading_interests: list[str]) -> dict[str, object]:
    """Fields a person may save. Role is never included."""
    interests: list[str] = []
    for interest in reading_interests:
        cleaned = interest.strip()
        if cleaned and cleaned not in interests:
            interests.append(cleaned)
    return {
        "full_name": full_name.strip(),
        "programme": programme.strip() if programme else None,
        "reading_interests": interests[:12],
    }
