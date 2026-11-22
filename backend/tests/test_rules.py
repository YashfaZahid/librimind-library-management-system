from datetime import datetime, timezone

import pytest

from app.services.rules import (
    RuleError,
    assert_can_issue,
    assert_can_reserve,
    due_at,
    fine_amount,
    overdue_days,
)


def test_due_date_is_the_loan_period_after_issue() -> None:
    issued = datetime(2026, 11, 21, 9, 0, tzinfo=timezone.utc)
    assert due_at(issued, 14) == datetime(2026, 12, 5, 9, 0, tzinfo=timezone.utc)


def test_fine_counts_whole_days_after_the_due_date() -> None:
    due = datetime(2026, 11, 1, 10, 0, tzinfo=timezone.utc)
    returned = datetime(2026, 11, 4, 8, 0, tzinfo=timezone.utc)
    assert overdue_days(due, returned) == 3
    assert fine_amount(3, 50) == 150
    assert fine_amount(0, 50) == 0


def test_a_reader_cannot_reserve_without_a_copy_or_twice() -> None:
    with pytest.raises(RuleError):
        assert_can_reserve(copy_count=0, has_open_loan=False, has_open_reservation=False)
    with pytest.raises(RuleError):
        assert_can_reserve(copy_count=1, has_open_loan=True, has_open_reservation=False)
    with pytest.raises(RuleError):
        assert_can_reserve(copy_count=1, has_open_loan=False, has_open_reservation=True)
    assert_can_reserve(copy_count=2, has_open_loan=False, has_open_reservation=False)


def test_issue_stops_at_the_loan_limit_and_a_held_copy() -> None:
    with pytest.raises(RuleError):
        assert_can_issue(
            copy_status="borrowed",
            ready_for_borrower=False,
            active_loans=0,
            max_active_loans=5,
            already_borrowed=False,
        )
    with pytest.raises(RuleError):
        assert_can_issue(
            copy_status="available",
            ready_for_borrower=False,
            active_loans=5,
            max_active_loans=5,
            already_borrowed=False,
        )
    assert_can_issue(
        copy_status="reserved",
        ready_for_borrower=True,
        active_loans=1,
        max_active_loans=5,
        already_borrowed=False,
    )
