import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusText } from "../../components/ui/StatusText";
import { CatalogueNotice } from "../../components/ui/CatalogueNotice";
import { useCatalogue } from "../../data/catalogue";
import { formatDate, formatMoney } from "../../domain/format";
import {
  bookById,
  copyById,
  loanState,
  loansForReader,
  readerById,
  reservationsForReader,
} from "../../domain/library";
import type { Loan } from "../../domain/types";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function LoansPage() {
  usePageTitle("Loans");
  const catalogue = useCatalogue();
  if (catalogue.status !== "ready" || !catalogue.library) return <CatalogueNotice />;
  const library = catalogue.library;
  const live = catalogue.source === "live";
  const reader = readerById(library.readers, library.sessionReaderId);
  const mine = loansForReader(library.loans, library.sessionReaderId);
  const active = mine.filter((loan) => loan.returnedOn === null);
  const returned = mine.filter((loan) => loan.returnedOn !== null);
  const held = reservationsForReader(library.reservations, library.sessionReaderId);
  const fines = library.fines.filter((fine) => fine.readerId === library.sessionReaderId && fine.status === "open");

  return (
    <div>
      <PageHeader
        kicker={reader?.programme}
        title={reader?.name ?? "Loans"}
        lede={
          live
            ? "Active loans, returned books, reservations, and open fines for your account."
            : "Active loans, returned books, and reservations for the sample reader."
        }
      />
      <section className="mt-12">
        <h2 className="font-serif text-2xl tracking-tight">Out now</h2>
        <LoanList loans={active} empty="Nothing is currently out for this reader." />
      </section>
      <section className="mt-12">
        <h2 className="font-serif text-2xl tracking-tight">Reservations</h2>
        {held.length === 0 ? (
          <p className="mt-4 border-t border-rule pt-4 text-sm text-ink-soft">No open reservation.</p>
        ) : (
          <ul className="mt-4">
            {held.map((reservation) => {
              const book = bookById(library.books, reservation.bookId);
              if (!book) return null;
              return (
                <li key={reservation.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-rule py-3">
                  <Link to={`/library/books/${book.id}`} className="font-serif text-xl hover:text-binding">
                    {book.title}
                  </Link>
                  <span className="flex items-center gap-4">
                    <StatusText>{reservation.status === "ready" ? "Ready" : "Waiting"}</StatusText>
                    {live && reservation.status === "waiting" ? <CancelHold reservationId={reservation.id} /> : null}
                    {live && reservation.status === "ready" ? (
                      <span className="text-sm text-ink-soft">Ask the desk to release it</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="mt-12">
        <h2 className="font-serif text-2xl tracking-tight">Fines</h2>
        {fines.length === 0 ? (
          <p className="mt-4 border-t border-rule pt-4 text-sm text-ink-soft">No open fine.</p>
        ) : (
          <ul className="mt-4">
            {fines.map((fine) => (
              <li key={fine.id} className="flex flex-wrap justify-between gap-3 border-t border-rule py-3 text-sm">
                <span>{fine.reason || "Overdue loan"}</span>
                <span>{formatMoney(fine.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-12">
        <h2 className="font-serif text-2xl tracking-tight">Returned</h2>
        <LoanList loans={returned} empty="No returned loan is recorded for this reader." />
      </section>
    </div>
  );
}

function CancelHold({ reservationId }: { reservationId: string }) {
  const catalogue = useCatalogue();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span>
      <Button
        onClick={() => {
          void catalogue.cancelReservation(reservationId).then((error) => setMessage(error));
        }}
      >
        Cancel
      </Button>
      {message ? <span className="ml-2 text-sm text-danger">{message}</span> : null}
    </span>
  );
}

function LoanList({ loans, empty }: { loans: Loan[]; empty: string }) {
  const catalogue = useCatalogue();
  const library = catalogue.library;
  if (!library || loans.length === 0) {
    return <p className="mt-4 border-t border-rule pt-4 text-sm text-ink-soft">{empty}</p>;
  }
  return (
    <ul className="mt-4">
      {loans.map((loan) => {
        const copy = copyById(library.copies, loan.copyId);
        const book = copy ? bookById(library.books, copy.bookId) : undefined;
        if (!book || !copy) return null;
        return (
          <li key={loan.id} className="grid gap-1 border-t border-rule py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
            <div>
              <Link to={`/library/books/${book.id}`} className="font-serif text-xl hover:text-binding">
                {book.title}
              </Link>
              <p className="mt-1 font-mono text-xs tracking-wide text-ink-soft">{copy.accession}</p>
            </div>
            <p className="flex flex-wrap gap-x-3 text-sm text-ink-soft">
              <span>{loan.returnedOn ? `Returned ${formatDate(loan.returnedOn)}` : `Due ${formatDate(loan.dueOn)}`}</span>
              <StatusText>{loanState(loan, library.today)}</StatusText>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
