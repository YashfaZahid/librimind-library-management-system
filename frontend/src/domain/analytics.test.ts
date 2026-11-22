import { describe, expect, it } from "vitest";
import { agentCalls, copyCounts, loansByWeek, readerActivity, titlesWithNoneAvailable, titlesWithoutACopy } from "./analytics";
import type { LibrarySnapshot } from "./types";

const library = {
  today: "2026-11-21",
  sessionReaderId: "r1",
  categories: [],
  books: [
    { id: "a", title: "Alpha", authors: [], categoryId: "c", year: 2000, publisher: "", isbn13: "", pages: 1, description: "" },
    { id: "b", title: "Beta", authors: [], categoryId: "c", year: 2000, publisher: "", isbn13: "", pages: 1, description: "" },
    { id: "c", title: "Gamma", authors: [], categoryId: "c", year: 2000, publisher: "", isbn13: "", pages: 1, description: "" },
  ],
  copies: [
    { id: "c1", bookId: "a", accession: "A1", status: "available" },
    { id: "c2", bookId: "a", accession: "A2", status: "borrowed" },
    { id: "c3", bookId: "b", accession: "B1", status: "borrowed" },
  ],
  readers: [
    { id: "r1", name: "Amina", email: "a@example.edu", programme: "", interestIds: [] },
    { id: "r2", name: "Owen", email: "o@example.edu", programme: "", interestIds: [] },
  ],
  loans: [
    { id: "l1", copyId: "c2", readerId: "r1", issuedOn: "2026-11-02", dueOn: "2026-11-16", returnedOn: null },
    { id: "l2", copyId: "c1", readerId: "r2", issuedOn: "2026-11-10", dueOn: "2026-11-24", returnedOn: "2026-11-12" },
  ],
  reservations: [{ id: "h1", bookId: "b", readerId: "r2", status: "waiting", placedOn: "2026-11-11" }],
  fines: [{ id: "f1", loanId: "l1", readerId: "r1", amountCents: 150, reason: "overdue", status: "open", createdOn: "2026-11-17" }],
} as LibrarySnapshot;

describe("analytics", () => {
  it("counts copies, missing stock, weeks, readers, and agent calls", () => {
    expect(copyCounts(library)).toEqual([
      { status: "borrowed", count: 2 },
      { status: "available", count: 1 },
    ]);
    expect(titlesWithoutACopy(library).map((row) => row.title)).toEqual(["Gamma"]);
    expect(titlesWithNoneAvailable(library).map((row) => row.title)).toEqual(["Beta"]);
    expect(loansByWeek(library)).toEqual([
      { week: "2026-11-02", loans: 1 },
      { week: "2026-11-09", loans: 1 },
    ]);
    expect(readerActivity(library)).toEqual({
      readers: 2,
      withOpenLoan: 1,
      withReservation: 1,
      openFines: 1,
      openFineCents: 150,
    });
    expect(
      agentCalls([
        { status: "succeeded", events: [{ agent: "search", success: true }, { agent: "verification", success: true }] },
        { status: "failed", events: [{ agent: "search", success: false }] },
      ]),
    ).toEqual({
      runs: 2,
      succeeded: 1,
      failed: 1,
      agents: [
        { agent: "search", calls: 2, succeeded: 1 },
        { agent: "verification", calls: 1, succeeded: 1 },
      ],
    });
  });
});
