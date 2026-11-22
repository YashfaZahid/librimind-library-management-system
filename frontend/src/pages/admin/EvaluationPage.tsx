import { useState } from "react";
import { FigureCard } from "../../components/ui/Charts";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { useAuth } from "../../auth/context";
import { useCatalogue } from "../../data/catalogue";
import { apiSend } from "../../lib/api";
import { usePageTitle } from "../../hooks/usePageTitle";

interface TaskRow {
  id: string;
  completed: boolean;
  toolMatch: boolean;
  policyPass: boolean;
  verificationMatch: boolean | null;
  elapsedMs: number;
}

interface Workflow {
  name: string;
  completed: number;
  toolMatches: number;
  policyPasses: number;
  policyTasks: number;
  verificationMatches: number | null;
  verificationTasks: number;
  elapsedMs: number;
  tasks: TaskRow[];
}

interface Study {
  tasks: number;
  note: string;
  workflows: Workflow[];
}

export default function EvaluationPage() {
  usePageTitle("Evaluation");
  const auth = useAuth();
  const catalogue = useCatalogue();
  const live = catalogue.source === "live";
  const [study, setStudy] = useState<Study | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run() {
    if (!live) {
      setMessage("Sign in and run this from the API. This preview does not invent scores.");
      return;
    }
    const token = auth.session?.access_token;
    if (!token) return;
    setPending(true);
    setMessage(null);
    try {
      setStudy(await apiSend<Study>("/api/v1/evaluation", token, "POST", {}));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The study did not finish.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Evaluation"
        title="Three ways of answering"
        lede="The same seven tasks run through a rule baseline, a single agent, and the multi-agent workflow with verification. The counts below are whatever that run just measured."
      />
      <Button className="mt-8" type="button" disabled={pending} onClick={() => void run()}>
        {pending ? "Running" : "Run the study"}
      </Button>
      {message ? <p className="mt-4 max-w-xl text-sm text-ink-soft">{message}</p> : null}
      {study ? (
        <div className="mt-10">
          <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">{study.note}</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {study.workflows.map((row) => (
              <FigureCard key={row.name} title={label(row.name)} caption={`${row.elapsedMs} ms`}>
                <ul>
                  <Score label="Completed" value={`${row.completed} of ${study.tasks}`} />
                  <Score label="Tool match" value={`${row.toolMatches} of ${study.tasks}`} />
                  <Score label="Policy pass" value={`${row.policyPasses} of ${row.policyTasks}`} />
                  <Score
                    label="Verification"
                    value={row.verificationTasks === 0 || row.verificationMatches === null ? "No re-read" : `${row.verificationMatches} of ${row.verificationTasks}`}
                  />
                </ul>
              </FigureCard>
            ))}
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-rule text-xs uppercase tracking-[0.14em] text-brass">
                <tr>
                  <th className="py-2 pr-4 font-medium">Workflow</th>
                  <th className="py-2 pr-4 font-medium">Completed</th>
                  <th className="py-2 pr-4 font-medium">Tool</th>
                  <th className="py-2 pr-4 font-medium">Policy</th>
                  <th className="py-2 pr-4 font-medium">Verification</th>
                  <th className="py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {study.workflows.map((row) => (
                  <tr key={row.name} className="border-b border-rule">
                    <th className="py-3 pr-4 font-serif text-xl font-normal tracking-tight">{label(row.name)}</th>
                    <td className="py-3 pr-4">{row.completed} of {study.tasks}</td>
                    <td className="py-3 pr-4">{row.toolMatches} of {study.tasks}</td>
                    <td className="py-3 pr-4">{row.policyPasses} of {row.policyTasks}</td>
                    <td className="py-3 pr-4">{row.verificationTasks === 0 || row.verificationMatches === null ? "No re-read" : `${row.verificationMatches} of ${row.verificationTasks}`}</td>
                    <td className="py-3">{row.elapsedMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-t border-rule py-2 first:border-t-0">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="font-serif text-xl">{value}</span>
    </li>
  );
}

function label(name: string): string {
  if (name === "single-agent") return "Single agent";
  if (name === "multi-agent") return "Multi-agent";
  return "Rule baseline";
}
