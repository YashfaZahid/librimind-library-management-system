import type { Book, Category } from "../../domain/types";

export const BOOKS_PER_ROW = 8;
export const ROOM_BOOK_LIMIT = 80;

export interface ShelfSlot {
  book: Book;
  column: number;
  rowSize: number;
}

export interface ShelfRow {
  id: string;
  categoryName: string;
  books: ShelfSlot[];
}

export function shelfRows(categories: Category[], books: Book[]): ShelfRow[] {
  const rows: ShelfRow[] = [];
  for (const category of categories) {
    const group = books
      .filter((book) => book.categoryId === category.id)
      .sort((left, right) => left.title.localeCompare(right.title));
    if (group.length === 0) {
      rows.push({ id: category.id, categoryName: category.name, books: [] });
      continue;
    }
    for (let start = 0; start < group.length; start += BOOKS_PER_ROW) {
      const slice = group.slice(start, start + BOOKS_PER_ROW);
      rows.push({
        id: `${category.id}-${start}`,
        categoryName: start === 0 ? category.name : "",
        books: slice.map((book, column) => ({ book, column, rowSize: slice.length })),
      });
    }
  }
  return rows;
}

export function shelfMode(input: {
  width: number;
  reducedMotion: boolean;
  webgl: boolean;
  bookCount: number;
}): "room" | "plain" {
  if (input.bookCount > ROOM_BOOK_LIMIT) return "plain";
  if (input.width < 768) return "plain";
  if (input.reducedMotion || !input.webgl) return "plain";
  return "room";
}

export function shelfModeReason(input: {
  width: number;
  reducedMotion: boolean;
  webgl: boolean;
  bookCount: number;
}): string {
  if (input.bookCount > ROOM_BOOK_LIMIT) return "The plain shelves are showing because this catalogue has more than 80 titles.";
  if (input.width < 768) return "The plain shelves are showing because this window is narrow.";
  if (input.reducedMotion) return "The plain shelves are showing because reduced motion is on.";
  if (!input.webgl) return "The plain shelves are showing because this browser has no WebGL.";
  return "";
}
