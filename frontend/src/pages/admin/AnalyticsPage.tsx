import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FigureCard, LineChart, RingChart, StatGrid } from "../../components/ui/Charts";
import { PageHeader } from "../../components/ui/PageHeader";
import { CatalogueNotice } from "../../components/ui/CatalogueNotice";
import { useAuth } from "../../auth/context";
import { useCatalogue } from "../../data/catalogue";
import { agentCalls, copyCounts, loansByWeek, readerActivity, titlesWithNoneAvailable, titlesWithoutACopy, type AgentRun } from "../../domain/analytics";
import { formatMoney } from "../../domain/format";
import { apiGet, apiRoot } from "../../lib/api";
import { usePageTitle } from "../../hooks/usePageTitle";

interface Health {
  status: string;
  auth_configured: boolean;
}

export default function AnalyticsPage() {
  usePageTitle("Analytics");
  const auth = useAuth();
  const catalogue = useCatalogue();
  const live = catalogue.source === "live";
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    if (!live) return;
    const root = apiRoot();
    void fetch(`${root}/api/v1/health`)
      .then(async (response) => {
        if (!response.ok) throw new Error("The health check did not answer.");
        setHealth((await response.json()) as Health);
      })
      .catch((caught: unknown) => setHealthError(caught instanceof Error ? caught.message : "The health check did not answer."));
    const token = auth.session?.access_token;
    if (!token) return;
    void apiGet<{ runs: AgentRun[] }>("/api/v1/assistant/runs", token)
      .then((body) => setRuns(body.runs))
      .catch((caught: unknown) => setRunError(caught instanceof Error ? caught.message : "The question count could not be read."));
  }, [auth.session?.access_token, live]);

  if (catalogue.status !== "ready" || !catalogue.library) return <CatalogueNotice />;
  const library = catalogue.library;
  const copies = copyCounts(library);
  const weeks = loansByWeek(library);
  const activity = readerActivity(library);
  const missing = titlesWithoutACopy(library);
  const stuck = titlesWithNoneAvailable(library);
  const agents = agentCalls(runs);

  return (
    <div>
      <PageHeader
        kicker="Analytics"
        title="The desk in figures"
        lede={
          live
            ? "Counts of the catalogue, the loans, and the fines."
            : "Counts from the preview catalogue. Sign in to see the library's own records."
        }
      />
      <p className="mt-4 text-sm text-ink-soft">
        <Link to="/admin/insights" className="border-b border-brass text-ink">
          Demand and the four-week forecast
        </Link>
      </p>

      <div className="mt-10 grid gap-4">
        <FigureCard title="System" caption="These three counts are separate. They do not add up to one total.">
          {live ? (
            <p className="mb-5 text-sm text-ink-soft">
              {health ? (health.status === "ok" ? "The library API is answering." : "The library API did not answer.") : healthError || "Checking the API."}
            </p>
          ) : (
            <p className="mb-5 text-sm text-ink-soft">Sign in to see whether the library API is answering.</p>
          )}
          <StatGrid
            rows={[
              { id: "titles", label: "Titles", value: String(library.books.length) },
              { id: "copies", label: "Copies", value: String(library.copies.length) },
              { id: "out", label: "Readers with a book out", value: String(activity.withOpenLoan) },
            ]}
          />
        </FigureCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <FigureCard title="Copies" caption="Each slice is a share of the copies on record.">
            <RingChart
              caption="Copies by status"
              rows={copies.map((row) => ({ id: row.status, label: labelStatus(row.status), value: row.count }))}
            />
          </FigureCard>
          <FigureCard title="Loans by week" caption="Each point is the number of loans issued that week.">
            {weeks.length === 0 ? <p className="text-sm text-ink-soft">No loans have been recorded.</p> : null}
            <LineChart
              caption="Loans by week"
              rows={weeks.map((row) => ({ id: row.week, label: row.week.slice(5), value: row.loans }))}
            />
          </FigureCard>
        </div>

        <FigureCard title="Readers" caption={`${activity.openFines} open fines, ${formatMoney(activity.openFineCents)}. These counts overlap, so they stay as numbers.`}>
          <StatGrid
            rows={[
              { id: "readers", label: "Readers", value: String(activity.readers) },
              { id: "loans", label: "With a book out", value: String(activity.withOpenLoan) },
              { id: "holds", label: "With a reservation", value: String(activity.withReservation) },
              { id: "fines", label: "Open fines", value: String(activity.openFines) },
            ]}
          />
        </FigureCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TitleList title="No copy recorded" rows={missing} empty="Every title has a copy." />
        <TitleList title="None available" rows={stuck} empty="Every title with a copy has one available." />
      </div>

      <div className="mt-4">
        <FigureCard title="Assistant" caption="Questions answered from this library.">
          {live ? (
            runError ? (
              <p className="text-sm text-ink-soft">{runError}</p>
            ) : agents.runs === 0 ? (
              <p className="text-sm text-ink-soft">No questions have been asked yet.</p>
            ) : (
              <p className="font-serif text-4xl tracking-tight">{agents.runs}</p>
            )
          ) : (
              <p className="text-sm text-ink-soft">Questions are counted after you sign in.</p>
          )}
        </FigureCard>
      </div>
    </div>
  );
}

function labelStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function TitleList({ title, rows, empty }: { title: string; rows: { bookId: string; title: string }[]; empty: string }) {
  return (
    <FigureCard title={title}>
      <ul>
        {rows.length === 0 ? <li className="border-t border-rule py-3 text-sm text-ink-soft">{empty}</li> : null}
        {rows.map((row) => (
          <li key={row.bookId} className="border-t border-rule py-3">
            <Link to={`/admin/books/${row.bookId}`} className="font-serif text-xl hover:text-binding">
              {row.title}
            </Link>
          </li>
        ))}
      </ul>
    </FigureCard>
  );
}
