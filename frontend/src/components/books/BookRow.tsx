import { Link } from "react-router-dom";
import { formatAuthors } from "../../domain/format";
import { availabilityLabel } from "../../domain/library";
import type { Book, Copy } from "../../domain/types";
import { BookCover } from "./BookCover";
import { StatusText } from "../ui/StatusText";

export function BookRow({
  book,
  category,
  copies,
}: {
  book: Book;
  category: string;
  copies: Copy[];
}) {
  const availability = availabilityLabel(copies, book.id);

  return (
    <li className="border-t border-rule">
      <Link
        to={`/library/books/${book.id}`}
        className="group grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-4 py-4"
      >
        <BookCover book={book} size="sm" />
        <span className="min-w-0">
          <span className="block font-serif text-xl tracking-tight text-ink transition-colors duration-200 group-hover:text-binding">
            {book.title}
          </span>
          <span className="mt-1 block text-sm text-ink-soft">
            {formatAuthors(book.authors)} · {category}
          </span>
          <span className="mt-2 block">
            <StatusText>{availability}</StatusText>
          </span>
        </span>
      </Link>
    </li>
  );
}
