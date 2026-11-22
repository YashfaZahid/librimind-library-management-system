import { describe, expect, it } from "vitest";
import { sampleLibrary } from "../mocks/sampleLibrary";
import {
  availabilityLabel,
  booksMatching,
  deskSentence,
  deskSummary,
  interestBooks,
  loanState,
  stockByCategory,
} from "./library";

describe("sample catalogue rules", () => {
  it("summarises the desk from loans and reservations", () => {
    const summary = deskSummary(sampleLibrary);
    expect(summary).toEqual({ out: 5, overdue: 1, openReservations: 2 });
    expect(deskSentence(summary)).toBe(
      "5 copies are out. 1 loan is overdue. 2 reservations are open.",
    );
  });

  it("keeps interest titles inside the sample reader's subjects", () => {
    const titles = interestBooks(sampleLibrary, sampleLibrary.sessionReaderId).map((book) => book.categoryId);
    expect(titles.length).toBeGreaterThan(0);
    expect(new Set(titles)).toEqual(new Set(["design", "literature"]));
  });

  it("searches titles, authors, and subjects without leaving the catalogue", () => {
    const plato = booksMatching(sampleLibrary.books, "plato", "all").map((book) => book.id);
    expect(plato).toEqual(["republic"]);
    const design = booksMatching(sampleLibrary.books, "", "design");
    expect(design).toHaveLength(3);
    expect(booksMatching(sampleLibrary.books, "zzzz-no-such-book", "all")).toHaveLength(0);
  });

  it("derives shelf availability from copy status", () => {
    expect(availabilityLabel(sampleLibrary.copies, "everyday-things")).toBe("2 copies on the shelf");
    expect(availabilityLabel(sampleLibrary.copies, "republic")).toBe("No copy on the shelf");
  });

  it("marks the November 15 loan overdue on the sample date", () => {
    const overdue = sampleLibrary.loans.find((loan) => loan.id === "l3");
    if (!overdue) throw new Error("Sample loan l3 is missing");
    expect(loanState(overdue, sampleLibrary.today)).toBe("Overdue");
  });

  it("pairs every borrowed copy with an open loan", () => {
    const openCopyIds = new Set(
      sampleLibrary.loans.filter((loan) => loan.returnedOn === null).map((loan) => loan.copyId),
    );
    const borrowed = sampleLibrary.copies.filter((copy) => copy.status === "borrowed");
    expect(borrowed.every((copy) => openCopyIds.has(copy.id))).toBe(true);
  });

  it("builds subject meters from copies rather than fixed chart data", () => {
    const stock = stockByCategory(sampleLibrary);
    const total = stock.reduce((sum, row) => sum + row.total, 0);
    expect(total).toBe(sampleLibrary.copies.length);
    expect(stock.every((row) => row.available <= row.total)).toBe(true);
  });
});
