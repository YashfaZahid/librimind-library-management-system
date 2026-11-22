import { useState } from "react";
import { Link } from "react-router-dom";
import { FigureCard, StatGrid } from "../../components/ui/Charts";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusText } from "../../components/ui/StatusText";
import { TextField } from "../../components/ui/TextField";
import { CatalogueNotice } from "../../components/ui/CatalogueNotice";
import { useCatalogue } from "../../data/catalogue";
import { formatDate, formatMoney } from "../../domain/format";
import {
  activeLoans,
  bookById,
  compareActiveLoans,
  copyById,
  loanState,
  readerById,
  returnedLoans,
} from "../../domain/library";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function CirculationPage() {
  usePageTitle("Circulation");
  const catalogue = useCatalogue();
  if (catalogue.status !== "ready" || !catalogue.library) return <CatalogueNotice />;
  const library = catalogue.library;
  const live = catalogue.source === "live";
  const open = activeLoans(library.loans).sort(compareActiveLoans(library.today));
  const returned = returnedLoans(library.loans);
  const fines = library.fines.filter((fine) => fine.status === "open");

  return (
    <div>
      <PageHeader
        kicker="Circulation"
        title="Loans and reservations"
        lede={
          live
            ? "Issue a copy by reader email and accession number. Returning an overdue copy records a fine."
            : "Sign in as a librarian to issue and return copies. This desk lists the sample loans."
        }
      />
      <nav className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="On this page">
        <a href="#issue" className="border-b border-brass text-ink">Issue a copy</a>
        <a href="#holds" className="border-b border-brass text-ink">Holds to approve</a>
        <a href="#out" className="border-b border-brass text-ink">Copies out</a>
        <a href="#fines" className="border-b border-brass text-ink">Open fines</a>
        <a href="#returned" className="border-b border-brass text-ink">Returned</a>
      </nav>
      <div className="mt-6">
        <FigureCard title="At a glance" caption="Open the section named below the number when you need to act on it.">
          <StatGrid
            rows={[
              { id: "out", label: "Out", value: String(open.length) },
              { id: "reserved", label: "Reserved", value: String(library.reservations.length) },
              { id: "fines", label: "Fines", value: String(fines.length) },
              { id: "returned", label: "Returned", value: String(returned.length) },
            ]}
          />
        </FigureCard>
      </div>
      <div id="issue" className="mt-10 scroll-mt-6">
        <h2 className="font-serif text-2xl tracking-tight">Issue a copy</h2>
        <p className="mt-2 max-w-xl text-sm text-ink-soft">Use the reader’s email and the copy’s accession number.</p>
        {live ? <IssueForm /> : <p className="mt-4 text-sm text-ink-soft">Sign in as a librarian to issue a copy.</p>}
      </div>
      <section id="out" className="mt-12 scroll-mt-6">
        <h2 className="font-serif text-2xl tracking-tight">Copies out</h2>
        {open.length === 0 ? (
          <p className="mt-4 border-t border-rule pt-4 text-sm text-ink-soft">No copy is out.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.14em] text-ink-soft">
                <tr>
                  <th scope="col" className="py-2 font-medium">Reader</th>
                  <th scope="col" className="py-2 font-medium">Title</th>
                  <th scope="col" className="py-2 font-medium">Copy</th>
                  <th scope="col" className="py-2 font-medium">Due</th>
                  <th scope="col" className="py-2 font-medium">State</th>
                  {live ? <th scope="col" className="py-2 font-medium">Return</th> : null}
                </tr>
              </thead>
              <tbody>
                {open.map((loan) => {
                  const copy = copyById(library.copies, loan.copyId);
                  const book = copy ? bookById(library.books, copy.bookId) : undefined;
                  const reader = readerById(library.readers, loan.readerId);
                  if (!copy || !book || !reader) return null;
                  return (
                    <tr key={loan.id} className="border-t border-rule">
                      <td className="py-3 pr-4">{reader.name}</td>
                      <td className="py-3 pr-4">
                        <Link to={`/admin/books/${book.id}`} className="hover:text-binding">
                          {book.title}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">{copy.accession}</td>
                      <td className="py-3 pr-4">{formatDate(loan.dueOn)}</td>
                      <td className="py-3 pr-4">
                        <StatusText>{loanState(loan, library.today)}</StatusText>
                      </td>
                      {live ? (
                        <td className="py-3">
                          <ReturnButton loanId={loan.id} />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Holds library={library} live={live} />
      <section id="fines" className="mt-12 scroll-mt-6">
        <h2 className="font-serif text-2xl tracking-tight">Open fines</h2>
        {fines.length === 0 ? (
          <p className="mt-4 border-t border-rule pt-4 text-sm text-ink-soft">No open fine.</p>
        ) : (
          <ul className="mt-4">
            {fines.map((fine) => {
              const reader = readerById(library.readers, fine.readerId);
              return (
                <li key={fine.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-rule py-3 text-sm">
                  <span>
                    {reader?.name ?? "Reader"} · {formatMoney(fine.amountCents)}
                    <span className="mt-1 block text-ink-soft">{fine.reason}</span>
                  </span>
                  {live ? (
                    <span className="flex gap-3">
                      <SettleButton fineId={fine.id} status="paid" label="Mark paid" />
                      <SettleButton fineId={fine.id} status="waived" label="Waive" />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section id="returned" className="mt-12 scroll-mt-6">
        <h2 className="font-serif text-2xl tracking-tight">Recently returned</h2>
        {returned.length === 0 ? (
          <p className="mt-4 border-t border-rule pt-4 text-sm text-ink-soft">No returned loan is recorded.</p>
        ) : (
          <ul className="mt-4">
            {returned.map((loan) => {
              const copy = copyById(library.copies, loan.copyId);
              const book = copy ? bookById(library.books, copy.bookId) : undefined;
              const reader = readerById(library.readers, loan.readerId);
              if (!book || !reader || !loan.returnedOn) return null;
              return (
                <li key={loan.id} className="flex flex-wrap justify-between gap-3 border-t border-rule py-3 text-sm">
                  <span>
                    {reader.name} · {book.title}
                  </span>
                  <span className="text-ink-soft">Returned {formatDate(loan.returnedOn)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Holds({ library, live }: { library: NonNullable<ReturnType<typeof useCatalogue>["library"]>; live: boolean }) {
  const waiting = library.reservations.filter((reservation) => reservation.status !== "ready");
  const ready = library.reservations.filter((reservation) => reservation.status === "ready");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const found = ready.filter((reservation) => {
    if (!needle) return true;
    const book = bookById(library.books, reservation.bookId);
    const reader = readerById(library.readers, reservation.readerId);
    return `${book?.title ?? ""} ${reader?.name ?? ""} ${reader?.email ?? ""}`.toLowerCase().includes(needle);
  });

  return (
    <section id="holds" className="mt-12 scroll-mt-6">
      <h2 className="font-serif text-2xl tracking-tight">Holds to approve</h2>
      <p className="mt-2 text-sm text-ink-soft">Waiting holds stay here. Approved holds stay in the record until you ask for them.</p>
      {waiting.length === 0 ? (
        <p className="mt-4 border-t border-rule pt-4 text-sm text-ink-soft">No hold is waiting.</p>
      ) : (
        <HoldList library={library} rows={waiting} live={live} />
      )}
      {ready.length > 0 ? (
        <div className="mt-6">
          <Button variant="secondary" type="button" onClick={() => setOpen((current) => !current)}>
            {open ? "Hide approved holds" : `Find an approved hold (${ready.length})`}
          </Button>
          {open ? (
            <div className="mt-4">
              <TextField label="Search approved holds" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title or reader" />
              {found.length === 0 ? <p className="mt-4 text-sm text-ink-soft">No approved hold matches.</p> : <HoldList library={library} rows={found} live={false} />}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function HoldList({
  library,
  rows,
  live,
}: {
  library: NonNullable<ReturnType<typeof useCatalogue>["library"]>;
  rows: NonNullable<ReturnType<typeof useCatalogue>["library"]>["reservations"];
  live: boolean;
}) {
  return (
    <ul className="mt-4">
      {rows.map((reservation) => {
        const book = bookById(library.books, reservation.bookId);
        const reader = readerById(library.readers, reservation.readerId);
        if (!book || !reader) return null;
        return (
          <li key={reservation.id} className="grid gap-3 border-t border-rule py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <p>
              <span className="text-ink">{reader.name}</span>
              <span className="text-ink-soft"> · </span>
              <Link to={`/admin/books/${book.id}`} className="font-serif text-lg hover:text-binding">
                {book.title}
              </Link>
            </p>
            <span className="flex items-center gap-4">
              <StatusText>{reservation.status === "ready" ? "Ready" : "Waiting"}</StatusText>
              {live && reservation.status === "waiting" ? <ApproveHold reservationId={reservation.id} /> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ApproveHold({ reservationId }: { reservationId: string }) {
  const catalogue = useCatalogue();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <span>
      <Button
        disabled={pending}
        onClick={() => {
          setPending(true);
          setMessage(null);
          void catalogue.approveReservation(reservationId).then((error) => {
            setMessage(error);
            setPending(false);
          });
        }}
      >
        {pending ? "Approving" : "Approve"}
      </Button>
      {message ? <span className="ml-2 text-sm text-danger">{message}</span> : null}
    </span>
  );
}

function IssueForm() {
  const catalogue = useCatalogue();
  const [email, setEmail] = useState("");
  const [accession, setAccession] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-4 grid max-w-xl gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setMessage(null);
        void catalogue.issue(email, accession).then((error) => {
          setMessage(error ? { tone: "error", text: error } : { tone: "ok", text: "Loan issued." });
          if (!error) {
            setEmail("");
            setAccession("");
          }
          setPending(false);
        });
      }}
    >
      <TextField label="Reader email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <TextField label="Accession" value={accession} onChange={(event) => setAccession(event.target.value)} required />
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Issuing" : "Issue copy"}
        </Button>
        {message ? (
          <p className={message.tone === "error" ? "mt-3 text-sm text-danger" : "mt-3 text-sm text-ink-soft"}>{message.text}</p>
        ) : null}
      </div>
    </form>
  );
}

function ReturnButton({ loanId }: { loanId: string }) {
  const catalogue = useCatalogue();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span>
      <Button
        disabled={pending}
        onClick={() => {
          setPending(true);
          void catalogue.returnLoan(loanId).then((error) => {
            setMessage(error);
            setPending(false);
          });
        }}
      >
        {pending ? "Returning" : "Return"}
      </Button>
      {message ? <span className="ml-2 text-danger">{message}</span> : null}
    </span>
  );
}

function SettleButton({ fineId, status, label }: { fineId: string; status: "paid" | "waived"; label: string }) {
  const catalogue = useCatalogue();
  const [pending, setPending] = useState(false);
  return (
    <Button
      disabled={pending}
      onClick={() => {
        setPending(true);
        void catalogue.settleFine(fineId, status).finally(() => setPending(false));
      }}
    >
      {label}
    </Button>
  );
}
