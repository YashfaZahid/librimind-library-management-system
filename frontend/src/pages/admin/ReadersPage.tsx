import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { TextField } from "../../components/ui/TextField";
import { CatalogueNotice } from "../../components/ui/CatalogueNotice";
import { useCatalogue } from "../../data/catalogue";
import { formatDate, formatMoney } from "../../domain/format";
import { bookById, categoryById, copyById, reservationsForReader, loansForReader } from "../../domain/library";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function ReadersPage() {
  usePageTitle("Readers");
  const catalogue = useCatalogue();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  if (catalogue.status !== "ready" || !catalogue.library) return <CatalogueNotice />;
  const library = catalogue.library;
  const live = catalogue.source === "live";
  const needle = query.trim().toLowerCase();
  const readers = library.readers.filter((reader) => {
    if (!needle) return true;
    const named = reader.interestIds
      .map((id) => categoryById(library.categories, id)?.name)
      .filter((name): name is string => Boolean(name));
    const interests = reader.interests?.length ? reader.interests : named;
    return [reader.name, reader.email, reader.programme, ...interests].join(" ").toLowerCase().includes(needle);
  });

  return (
    <div>
      <PageHeader
        kicker="Readers"
        title={live ? "People with an account" : "People with a sample account"}
        lede={
          live
            ? "Search a name, email, programme, or interest. Open a person to see their loans, holds, and fines."
            : "These four readers exist only in the preview catalogue."
        }
      />
      <div className="mt-8 max-w-md">
        <TextField label="Search readers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, or interest" />
      </div>
      {readers.length === 0 ? <p className="mt-6 text-sm text-ink-soft">No reader matches.</p> : null}
      <ul className="mt-6">
        {readers.map((reader) => {
          const named = reader.interestIds
            .map((id) => categoryById(library.categories, id)?.name)
            .filter((name): name is string => Boolean(name));
          const interests = (reader.interests?.length ? reader.interests : named).join(", ");
          const loans = loansForReader(library.loans, reader.id);
          const holds = reservationsForReader(library.reservations, reader.id);
          const fines = library.fines.filter((fine) => fine.readerId === reader.id && fine.status === "open");
          const open = openId === reader.id || needle.length > 0;
          return (
            <li key={reader.id} className="border-t border-rule py-4">
              <button type="button" className="w-full text-left" onClick={() => setOpenId(open && !needle ? null : reader.id)}>
                <span className="font-serif text-2xl tracking-tight">{reader.name}</span>
                <span className="mt-1 block text-sm text-ink-soft">{reader.email}</span>
                <span className="mt-1 block text-sm text-ink-soft">
                  {[reader.programme, interests].filter(Boolean).join(" · ") || "No programme or interest recorded"}
                </span>
                <span className="mt-2 block text-sm text-ink">
                  {loans.filter((loan) => loan.returnedOn === null).length} out · {holds.length} holds · {fines.length} open fines
                </span>
              </button>
              {open ? (
                <div className="mt-4 grid gap-4 border border-rule bg-paper-raised p-4 sm:grid-cols-3">
                  <Record title="Loans">
                    {loans.length === 0 ? <p className="text-sm text-ink-soft">None.</p> : null}
                    {loans.map((loan) => {
                      const copy = copyById(library.copies, loan.copyId);
                      const book = copy ? bookById(library.books, copy.bookId) : undefined;
                      if (!book) return null;
                      return (
                        <p key={loan.id} className="text-sm">
                          <Link to={`/admin/books/${book.id}`} className="hover:text-binding">{book.title}</Link>
                          <span className="block text-ink-soft">{loan.returnedOn ? `Returned ${formatDate(loan.returnedOn)}` : `Due ${formatDate(loan.dueOn)}`}</span>
                        </p>
                      );
                    })}
                  </Record>
                  <Record title="Holds">
                    {holds.length === 0 ? <p className="text-sm text-ink-soft">None.</p> : null}
                    {holds.map((hold) => {
                      const book = bookById(library.books, hold.bookId);
                      if (!book) return null;
                      return (
                        <p key={hold.id} className="text-sm">
                          <Link to={`/admin/books/${book.id}`} className="hover:text-binding">{book.title}</Link>
                          <span className="block capitalize text-ink-soft">{hold.status}</span>
                        </p>
                      );
                    })}
                  </Record>
                  <Record title="Open fines">
                    {fines.length === 0 ? <p className="text-sm text-ink-soft">None.</p> : null}
                    {fines.map((fine) => (
                      <p key={fine.id} className="text-sm">
                        {formatMoney(fine.amountCents)}
                        <span className="block text-ink-soft">{fine.reason}</span>
                      </p>
                    ))}
                  </Record>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Record({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-brass">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}
