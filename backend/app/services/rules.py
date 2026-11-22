from datetime import datetime, timedelta, timezone


class RuleError(Exception):
    def __init__(self, detail: str, status_code: int = 400) -> None:
        self.detail = detail
        self.status_code = status_code


def due_at(issued_at: datetime, loan_period_days: int) -> datetime:
    return issued_at + timedelta(days=loan_period_days)


def overdue_days(due: datetime, returned: datetime) -> int:
    late = (returned.date() - due.date()).days
    return late if late > 0 else 0


def fine_amount(days_late: int, daily_fine_cents: int) -> int:
    if days_late <= 0 or daily_fine_cents <= 0:
        return 0
    return days_late * daily_fine_cents


def hold_expires(ready_at: datetime, hold_days: int) -> datetime:
    return ready_at + timedelta(days=hold_days)


def assert_can_reserve(*, copy_count: int, has_open_loan: bool, has_open_reservation: bool) -> None:
    if copy_count < 1:
        raise RuleError("This title has no physical copy to reserve.")
    if has_open_loan:
        raise RuleError("You already have this title on loan.")
    if has_open_reservation:
        raise RuleError("You already have an open reservation for this title.")


def assert_can_issue(
    *,
    copy_status: str,
    ready_for_borrower: bool,
    active_loans: int,
    max_active_loans: int,
    already_borrowed: bool,
) -> None:
    allowed = copy_status == "available" or (copy_status == "reserved" and ready_for_borrower)
    if not allowed:
        raise RuleError("That copy is not available to issue.")
    if already_borrowed:
        raise RuleError("This reader already has this title on loan.")
    if active_loans >= max_active_loans:
        raise RuleError(f"This reader already has {max_active_loans} books out.")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
