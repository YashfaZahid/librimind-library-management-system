import { Link } from "react-router-dom";
import { BookCover } from "../../components/books/BookCover";
import { StatusText } from "../../components/ui/StatusText";
import { CatalogueNotice } from "../../components/ui/CatalogueNotice";
import { useCatalogue } from "../../data/catalogue";
import { formatAuthors, formatDate, formatLongDate } from "../../domain/format";
import {
  availabilityLabel,
  bookById,
  categoryById,
  compareActiveLoans,
  copyById,
  interestBooks,
  interestLabel,
  loanState,
  loansForReader,
  readerById,
  reservationsForReader,
} from "../../domain/library";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function HomePage() {
  usePageTitle("Home");
  const catalogue = useCatalogue();
  if (catalogue.status !== "ready" || !catalogue.library) return <CatalogueNotice />;
  const library = catalogue.library;
  const live = catalogue.source === "live";
  const reader = readerById(library.readers, library.sessionReaderId);
  const featured = bookById(library.books, "everyday-things") ?? library.books[0];
  const featuredCategory = featured ? categoryById(library.categories, featured.categoryId)?.name : "";
  const due = loansForReader(library.loans, library.sessionReaderId)
    .filter((loan) => loan.returnedOn === null)
    .sort(compareActiveLoans(library.today));
  const held = reservationsForReader(library.reservations, library.sessionReaderId);
  const interests = interestBooks(library, library.sessionReaderId);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-brass">{formatLongDate(library.today)}</p>
      <h1 className="mt-3 max-w-xl font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl">
        What will you read, {reader ? firstName(reader.name) : "reader"}?
      </h1>
      <p className="mt-4 text-sm text-ink-soft">
        <Link to="/library/shelf" className="border-b border-brass text-ink">
          Enter the book room
        </Link>
      </p>

      {featured ? (
        <article className="mt-12 grid items-end gap-8 border-t border-rule pt-8 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <Link to={`/library/books/${featured.id}`} className="group w-fit">
            <BookCover book={featured} category={featuredCategory} size="lg" />
          </Link>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brass">On the shelf</p>
            <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">
              <Link to={`/library/books/${featured.id}`} className="hover:text-binding">
                {featured.title}
              </Link>
            </h2>
            <p className="mt-2 text-ink-soft">
              {formatAuthors(featured.authors)} · {featuredCategory}
            </p>
            <p className="mt-4 max-w-xl leading-relaxed text-ink">{featured.description}</p>
            <p className="mt-4">
              <StatusText>{availabilityLabel(library.copies, featured.id)}</StatusText>
            </p>
          </div>
        </article>
      ) : null}

      <div className="mt-16 grid gap-14 lg:grid-cols-2">
        <section>
          <h2 className="font-serif text-2xl tracking-tight">Due soon</h2>
          <ul className="mt-4">
            {due.map((loan) => {
              const copy = copyById(library.copies, loan.copyId);
              const book = copy ? bookById(library.books, copy.bookId) : undefined;
              if (!book) return null;
              return (
                <li key={loan.id} className="border-t border-rule py-3">
                  <Link to={`/library/books/${book.id}`} className="font-serif text-xl hover:text-binding">
                    {book.title}
                  </Link>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-ink-soft">
                    <span>Due {formatDate(loan.dueOn)}</span>
                    <StatusText>{loanState(loan, library.today)}</StatusText>
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-2xl tracking-tight">Held for you</h2>
          {held.length === 0 ? (
            <p className="mt-4 border-t border-rule pt-4 text-sm text-ink-soft">
              {live ? "No reservation is held for you." : "No reservation is held in this sample."}
            </p>
          ) : (
            <ul className="mt-4">
              {held.map((reservation) => {
                const book = bookById(library.books, reservation.bookId);
                if (!book) return null;
                const label = reservation.status === "ready" ? "Ready" : "Waiting";
                return (
                  <li key={reservation.id} className="border-t border-rule py-3">
                    <Link to={`/library/books/${book.id}`} className="font-serif text-xl hover:text-binding">
                      {book.title}
                    </Link>
                    <p className="mt-1">
                      <StatusText>{label}</StatusText>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-16">
        <h2 className="font-serif text-2xl tracking-tight">
          <Link to="/library/for-you" className="hover:text-binding">
            From your interests
          </Link>
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          {live ? "Taken from your profile" : "Taken from the sample profile"}: {interestLabel(library, library.sessionReaderId)}.
        </p>
        <ul className="mt-6 flex gap-5 overflow-x-auto pb-4">
          {interests.map((book) => (
            <li key={book.id}>
              <Link to={`/library/books/${book.id}`} className="group block w-28">
                <BookCover book={book} category={categoryById(library.categories, book.categoryId)?.name} size="md" />
                <span className="mt-3 block font-serif text-sm leading-snug text-ink group-hover:text-binding">
                  {book.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}
