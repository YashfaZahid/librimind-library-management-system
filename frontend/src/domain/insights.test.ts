import { describe, expect, it } from "vitest";
import { demand, forecast, popularity } from "./insights";
import type { LibrarySnapshot } from "./types";

const library = {
  today: "2026-11-21",
  sessionReaderId: "r1",
  categories: [],
  readers: [],
  fines: [],
  books: [
    { id: "a", title: "Alpha", authors: [], categoryId: "c", year: 2000, publisher: "", isbn13: "", pages: 1, description: "" },
    { id: "b", title: "Beta", authors: [], categoryId: "c", year: 2000, publisher: "", isbn13: "", pages: 1, description: "" },
  ],
  copies: [
    { id: "c1", bookId: "a", accession: "A", status: "available" },
    { id: "c2", bookId: "b", accession: "B", status: "borrowed" },
  ],
  loans: [
    { id: "l1", copyId: "c1", readerId: "r1", issuedOn: "2026-10-05", dueOn: "2026-10-19", returnedOn: "2026-10-12" },
    { id: "l2", copyId: "c1", readerId: "r1", issuedOn: "2026-10-19", dueOn: "2026-11-02", returnedOn: "2026-10-26" },
    { id: "l3", copyId: "c2", readerId: "r1", issuedOn: "2026-11-02", dueOn: "2026-11-16", returnedOn: null },
  ],
  reservations: [{ id: "r", bookId: "a", readerId: "r1", status: "waiting", placedOn: "2026-11-01" }],
} as LibrarySnapshot;

describe("insights", () => {
  it("counts loans, open reservations, and the four-week projection", () => {
    expect(popularity(library)[0]).toMatchObject({ bookId: "a", count: 2 });
    expect(demand(library)[0]).toMatchObject({ bookId: "a", count: 3 });
    const projected = forecast(library);
    expect(projected.method).toContain("average loans per week");
    expect(projected.check).toContain("latest week");
    const beta = projected.titles.find((row) => row.bookId === "b");
    expect(beta?.available).toBe(0);
    expect(beta && beta.shortfall).toBeGreaterThan(0);
  });
});
