import { describe, expect, it } from "vitest";
import { sampleLibrary } from "../../mocks/sampleLibrary";
import { BOOKS_PER_ROW, shelfMode, shelfRows } from "./layout";

describe("shelf layout", () => {
  it("gives every subject a row and keeps a long subject on more than one row", () => {
    const rows = shelfRows(sampleLibrary.categories, sampleLibrary.books);
    expect(rows.some((row) => row.categoryName === "Philosophy")).toBe(true);
    const crowded = shelfRows(
      [{ id: "design", name: "Design" }],
      Array.from({ length: BOOKS_PER_ROW + 1 }, (_, index) => ({
        id: `b-${index}`,
        title: `Title ${index}`,
        authors: ["Author"],
        categoryId: "design",
        year: 2000,
        publisher: "",
        isbn13: "",
        pages: 1,
        description: "",
      })),
    );
    expect(crowded).toHaveLength(2);
    expect(crowded[1]?.books).toHaveLength(1);
  });

  it("chooses the plain shelves when the room would be a poor fit", () => {
    const room = { width: 1200, reducedMotion: false, webgl: true, bookCount: 12 };
    expect(shelfMode(room)).toBe("room");
    expect(shelfMode({ ...room, width: 390 })).toBe("plain");
    expect(shelfMode({ ...room, reducedMotion: true })).toBe("plain");
    expect(shelfMode({ ...room, webgl: false })).toBe("plain");
    expect(shelfMode({ ...room, bookCount: 81 })).toBe("plain");
  });
});
