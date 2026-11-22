import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCatalogue } from "../../data/catalogue";
import { useDigital } from "../../data/digital";
import { formatAuthors } from "../../domain/format";
import { availabilityLabel } from "../../domain/library";
import type { Book, LibrarySnapshot } from "../../domain/types";
import { Button } from "../ui/Button";

export function ShelfDetail({
  book,
  category,
  snapshot,
}: {
  book: Book | null;
  category: string;
  snapshot?: LibrarySnapshot | null;
}) {
  const catalogue = useCatalogue();
  const digital = useDigital();
  const inDesk = useLocation().pathname.startsWith("/admin");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const library = snapshot ?? catalogue.library;
  if (!book || !library) {
    return <p className="text-sm text-ink-soft">Choose a book to see whether a copy or a PDF is available.</p>;
  }
  const live = catalogue.source === "live";
  const digitalCopy = digital.library?.assets.find((asset) => asset.bookId === book.id && asset.scope === "institutional");
  const copies = library.copies.filter((copy) => copy.bookId === book.id);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-brass">{category || "Shelf"}</p>
      <h2 className="mt-1 font-serif text-3xl tracking-tight">{book.title}</h2>
      <p className="mt-2 text-ink-soft">{formatAuthors(book.authors)}</p>
      <p className="mt-4 max-w-xl leading-relaxed">{book.description}</p>
      <p className="mt-4 text-sm text-available">{availabilityLabel(library.copies, book.id)}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link to={inDesk ? `/admin/books/${book.id}` : `/library/books/${book.id}`} className="border-b border-brass text-sm text-ink">
          Open the record
        </Link>
        {digitalCopy ? (
          <Link to={`${inDesk ? `/admin/digital/${digitalCopy.id}` : `/library/digital/${digitalCopy.id}`}?read=1`} className="border-b border-brass text-sm text-ink">
            Open the PDF
          </Link>
        ) : (
          <span className="text-sm text-ink-soft">No library PDF</span>
        )}
        {live && copies.length > 0 ? (
          <Button
            disabled={pending}
            onClick={() => {
              setPending(true);
              setMessage(null);
              void catalogue.reserve(book.id).then((error) => {
                setMessage(error ?? "Reservation placed. A librarian issues the copy.");
                setPending(false);
              });
            }}
          >
            {pending ? "Reserving" : "Reserve"}
          </Button>
        ) : null}
      </div>
      {message ? <p className="mt-3 text-sm text-ink-soft">{message}</p> : null}
    </div>
  );
}
