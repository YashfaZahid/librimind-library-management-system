import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FigureCard, RankedList } from "../../components/ui/Charts";
import { PageHeader } from "../../components/ui/PageHeader";
import { CatalogueNotice } from "../../components/ui/CatalogueNotice";
import { useAuth } from "../../auth/context";
import { useCatalogue } from "../../data/catalogue";
import { demand, forecast, popularity } from "../../domain/insights";
import { apiGet } from "../../lib/api";
import { usePageTitle } from "../../hooks/usePageTitle";

interface InsightPayload {
  modelVersion: string;
  popularity: { bookId: string; title: string; loans: number }[];
  demand: { bookId: string; title: string; demand: number }[];
  forecast: { method: string; check: string; titles: { bookId: string; title: string; projectedLoans: number; available: number; shortfall: number }[] };
  evaluation: { sentence: string; modelVersion: string };
}

export default function InsightsPage() {
  usePageTitle("Insights");
  const auth = useAuth();
  const catalogue = useCatalogue();
  const live = catalogue.source === "live";
  const [remote, setRemote] = useState<InsightPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!live) return;
    const token = auth.session?.access_token;
    if (!token) return;
    void apiGet<InsightPayload>("/api/v1/insights", token)
      .then(setRemote)
      .catch((caught: unknown) => setMessage(caught instanceof Error ? caught.message : "The figures could not be loaded."));
  }, [auth.session?.access_token, live]);

  if (!live && (catalogue.status !== "ready" || !catalogue.library)) return <CatalogueNotice />;
  const library = catalogue.library;
  const popular = remote ? remote.popularity.map((row) => ({ bookId: row.bookId, title: row.title, count: row.loans })) : library ? popularity(library) : [];
  const demanded = remote ? remote.demand.map((row) => ({ bookId: row.bookId, title: row.title, count: row.demand })) : library ? demand(library) : [];
  const projected = remote ? remote.forecast : library ? forecast(library) : null;

  return (
    <div>
      <PageHeader
        kicker="Insights"
        title="What the shelves are doing"
        lede={
          live
            ? "Popularity, demand, and the four-week forecast are counted from stored loans. The model line is a hold-out on those loans, not a general accuracy claim."
            : "These figures are counted from the preview loans. The hold-out check runs on stored loans after you sign in."
        }
      />
      <p className="mt-4 text-sm text-ink-soft">
        <Link to="/admin/analytics" className="border-b border-brass text-ink">
          Copies, readers, and loans
        </Link>
      </p>
      {message ? <p className="mt-4 text-sm text-ink-soft">{message}</p> : null}
      {remote ? <p className="mt-6 max-w-2xl text-sm leading-relaxed">{remote.evaluation.sentence}</p> : null}
      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <CountList title="Often borrowed" rows={popular} empty="No loans have been recorded." />
        <CountList title="Demand" detail="Recorded loans plus open reservations." rows={demanded} empty="No loans or open reservations." />
      </div>
      {projected ? (
        <div className="mt-4">
          <FigureCard title="Four-week forecast" caption={`${projected.method} ${projected.check}`}>
            {projected.titles.length === 0 ? <p className="text-sm text-ink-soft">No title has a recorded loan.</p> : null}
            <RankedList
              rows={projected.titles.map((row) => ({
                id: row.bookId,
                value: row.projectedLoans,
                hint: `${row.projectedLoans.toFixed(2)} projected · ${row.available} available${row.shortfall ? ` · short ${row.shortfall}` : ""}`,
                label: (
                  <Link to={`/admin/books/${row.bookId}`} className="font-serif text-xl hover:text-binding">
                    {row.title}
                  </Link>
                ),
              }))}
            />
          </FigureCard>
        </div>
      ) : null}
    </div>
  );
}

function CountList({ title, detail, rows, empty }: { title: string; detail?: string; rows: { bookId: string; title: string; count: number }[]; empty: string }) {
  return (
    <FigureCard title={title} caption={detail}>
      {rows.length === 0 ? <p className="text-sm text-ink-soft">{empty}</p> : null}
      <RankedList
        rows={rows.map((row) => ({
          id: row.bookId,
          value: row.count,
          hint: String(row.count),
          label: (
            <Link to={`/admin/books/${row.bookId}`} className="font-serif text-xl hover:text-binding">
              {row.title}
            </Link>
          ),
        }))}
      />
    </FigureCard>
  );
}
