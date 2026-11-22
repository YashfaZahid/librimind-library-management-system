import { BookCover } from "../books/BookCover";
import type { ShelfRow } from "./layout";

export function PlainShelf({
  rows,
  selectedId,
  onSelect,
}: {
  rows: ShelfRow[];
  selectedId: string | null;
  onSelect: (bookId: string) => void;
}) {
  return (
    <div className="space-y-8">
      {rows.map((row) => (
        <section key={row.id} aria-labelledby={row.categoryName ? `plain-${row.id}` : undefined}>
          {row.categoryName ? (
            <h2 id={`plain-${row.id}`} className="border-b border-rule pb-2 font-serif text-2xl tracking-tight">
              {row.categoryName}
            </h2>
          ) : null}
          {row.books.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">No title in this subject.</p>
          ) : (
            <ul className="mt-4 flex gap-4 overflow-x-auto pb-2">
              {row.books.map((slot) => {
                const selected = slot.book.id === selectedId;
                return (
                  <li key={slot.book.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onSelect(slot.book.id)}
                      className={selected ? "rounded-sm ring-2 ring-brass ring-offset-2 ring-offset-paper" : undefined}
                    >
                      <BookCover book={slot.book} category={row.categoryName || undefined} size="md" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
