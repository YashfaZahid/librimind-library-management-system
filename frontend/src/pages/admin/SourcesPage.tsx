import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { useAuth } from "../../auth/context";
import { useCatalogue } from "../../data/catalogue";
import { apiGet, apiSend } from "../../lib/api";
import { usePageTitle } from "../../hooks/usePageTitle";

interface Source {
  id: string;
  name: string;
  policy: string;
  enabled: boolean;
  notes: string;
}

const sampleSources: Source[] = [
  {
    id: "gutenberg",
    name: "Project Gutenberg",
    policy: "permitted_open_access",
    enabled: true,
    notes: "Public-domain texts. A file may be saved only when Gutenberg offers that file for download.",
  },
  {
    id: "open-library",
    name: "Open Library",
    policy: "metadata_only",
    enabled: true,
    notes: "Metadata and a link. A catalogue record is not a downloadable file.",
  },
  {
    id: "archive",
    name: "Internet Archive",
    policy: "permitted_open_access",
    enabled: true,
    notes: "A file is saved only when the item rights are explicitly public domain or an open license.",
  },
];

export default function SourcesPage() {
  usePageTitle("Sources");
  const auth = useAuth();
  const catalogue = useCatalogue();
  const live = catalogue.source === "live";
  const [sources, setSources] = useState<Source[]>(sampleSources);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!live) return;
    const token = auth.session?.access_token;
    if (!token) return;
    void apiGet<{ sources: Source[] }>("/api/v1/discovery/sources", token)
      .then((body) => setSources(body.sources))
      .catch((caught: unknown) => setMessage(caught instanceof Error ? caught.message : "The sources could not be read."));
  }, [auth.session?.access_token, live]);

  async function toggle(source: Source) {
    if (!live) {
      setMessage("This preview does not change approved sources.");
      return;
    }
    const token = auth.session?.access_token;
    if (!token) return;
    try {
      await apiSend(`/api/v1/discovery/sources/${source.id}`, token, "PATCH", { enabled: !source.enabled });
      setSources((current) => current.map((item) => (item.id === source.id ? { ...item, enabled: !source.enabled } : item)));
      setMessage(null);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The source could not be changed.");
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Sources"
        title="Approved sources"
        lede="These three sources are fixed. A librarian can turn one off. The name, address, and download rule stay as they were seeded."
      />
      {message ? <p className="mt-4 text-sm text-ink-soft">{message}</p> : null}
      <ul className="mt-10">
        {sources.map((source) => (
          <li key={source.id} className="border-t border-rule py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-serif text-2xl tracking-tight">{source.name}</h2>
              <Button onClick={() => void toggle(source)}>
                {source.enabled ? "Turn off" : "Turn on"}
              </Button>
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              {source.policy === "metadata_only" ? "Metadata only" : "Permitted open access"}
              {source.enabled ? "" : " · Off"}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed">{source.notes}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
