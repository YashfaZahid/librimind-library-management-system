import { Link } from "react-router-dom";
import { FigureCard, RankedList, StatGrid } from "../../components/ui/Charts";
import { StatusText } from "../../components/ui/StatusText";
import { CatalogueNotice } from "../../components/ui/CatalogueNotice";
import { useCatalogue } from "../../data/catalogue";
import { formatDate, formatLongDate } from "../../domain/format";
import {
  activeLoans,
  bookById,
  compareActiveLoans,
  copyById,
  deskSentence,
  deskSummary,
  loanState,
  readerById,
  stockByCategory,
} from "../../domain/library";
import { usePageTitle } from "../../hooks/usePageTitle";

const places = [
  { group: "Today", to: "/admin/circulation", title: "Circulation", detail: "Approve a waiting hold, issue a copy, take a return, and settle a fine." },
  { group: "Collection", to: "/admin/shelf", title: "Shelf", detail: "Find a title and see its cover on the shelf." },
  { group: "Collection", to: "/admin/catalogue", title: "Catalogue", detail: "Add a physical book, or correct a title already in the library." },
  { group: "Collection", to: "/admin/digital", title: "Digital", detail: "Add a library PDF. It is filed with a cover." },
  { group: "People", to: "/admin/readers", title: "Readers", detail: "See who has an account." },
  { group: "Figures", to: "/admin/analytics", title: "Analytics", detail: "Counts of titles, copies, loans, and readers." },
  { group: "Figures", to: "/admin/insights", title: "Insights", detail: "Which titles are borrowed, and the four-week forecast." },
  { group: "Figures", to: "/admin/evaluation", title: "Evaluation", detail: "Run the study that compares the three ways of answering." },
  { group: "Tools", to: "/admin/assistant", title: "Assistant", detail: "Ask about a title, a loan, or what to read next." },
  { group: "Tools", to: "/admin/sources", title: "Sources", detail: "Which outside libraries a reader is allowed to save from." },
];

export default function DeskPage() {
  usePageTitle("Desk");
  const catalogue = useCatalogue();
  if (catalogue.status !== "ready" || !catalogue.library) return <CatalogueNotice />;
  const library = catalogue.library;
  const summary = deskSummary(library);
  const attention = activeLoans(library.loans).sort(compareActiveLoans(library.today));
  const stock = stockByCategory(library);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-brass">{formatLongDate(library.today)}</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight sm:text-5xl">Desk</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink">{deskSentence(summary)}</p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
        Start here when you are not sure which page to open. The menu uses the same groups.
      </p>

      <section className="mt-10">
        <h2 className="font-serif text-2xl tracking-tight">Where to look</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {places.map((place) => (
            <Link key={place.to} to={place.to} className="block border border-rule bg-paper-raised p-4 hover:border-brass">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-brass">{place.group}</p>
              <p className="mt-2 font-serif text-2xl tracking-tight">{place.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{place.detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-4">
        <FigureCard title="Today" caption="Overdue loans are already counted among the copies that are out.">
          <StatGrid
            rows={[
              { id: "out", label: "Out", value: String(summary.out) },
              { id: "overdue", label: "Overdue loans", value: String(summary.overdue) },
              { id: "reserved", label: "Reserved", value: String(summary.openReservations) },
            ]}
          />
        </FigureCard>

        <FigureCard title="Needs attention" caption="Open loans, soonest due first. Open Circulation to return one.">
          {attention.length === 0 ? <p className="text-sm text-ink-soft">No copy is out.</p> : null}
          <ul>
            {attention.map((loan) => {
              const copy = copyById(library.copies, loan.copyId);
              const book = copy ? bookById(library.books, copy.bookId) : undefined;
              const reader = readerById(library.readers, loan.readerId);
              if (!book || !copy || !reader) return null;
              return (
                <li key={loan.id} className="grid gap-1 border-t border-rule py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-8">
                  <div className="min-w-0">
                    <Link to={`/admin/books/${book.id}`} className="font-serif text-xl hover:text-binding">
                      {book.title}
                    </Link>
                    <p className="mt-1 text-sm text-ink-soft">
                      {reader.name} · <span className="font-mono text-xs">{copy.accession}</span>
                    </p>
                  </div>
                  <p className="flex flex-wrap gap-x-3 text-sm text-ink-soft">
                    <span>Due {formatDate(loan.dueOn)}</span>
                    <StatusText>{loanState(loan, library.today)}</StatusText>
                  </p>
                </li>
              );
            })}
          </ul>
        </FigureCard>

        <FigureCard title="Copies by subject" caption="How many copies sit in each subject, and how many of those are on the shelf.">
          <RankedList
            rows={stock.map((row) => ({
              id: row.id,
              label: row.name,
              value: row.total,
              hint: `${row.available} of ${row.total} on the shelf`,
            }))}
          />
        </FigureCard>
      </div>
    </div>
  );
}
