import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { useAuth } from "../../auth/context";
import { coverFromSource } from "../../components/books/coverTone";
import { useCatalogue } from "../../data/catalogue";
import { useDigital } from "../../data/digital";
import { ApiError, apiGet, apiSend } from "../../lib/api";
import { usePageTitle } from "../../hooks/usePageTitle";

interface Hit {
  id: string;
  source: string;
  title: string;
  authors: string[];
  rights: string;
  pageUrl: string;
  fileUrl: string;
  coverUrl?: string;
  download: "available" | "unavailable";
  reason: string;
}

interface Group {
  source: string;
  results: Hit[];
  error: string;
}

const sampleGroups: Group[] = [
  {
    source: "Project Gutenberg",
    error: "",
    results: [
      {
        id: "sample-gut",
        source: "Project Gutenberg",
        title: "The Republic",
        authors: ["Plato"],
        rights: "Public domain",
        pageUrl: "https://www.gutenberg.org/ebooks/1497",
        fileUrl: "",
        download: "available",
        reason: "",
      },
    ],
  },
  {
    source: "Open Library",
    error: "",
    results: [
      {
        id: "sample-ol",
        source: "Open Library",
        title: "The Republic",
        authors: ["Plato"],
        rights: "",
        pageUrl: "https://openlibrary.org/works/OL61937W",
        fileUrl: "",
        download: "unavailable",
        reason: "This record is not available for download.",
      },
    ],
  },
  {
    source: "Internet Archive",
    error: "",
    results: [
      {
        id: "sample-ia",
        source: "Internet Archive",
        title: "The Republic",
        authors: ["Plato"],
        rights: "Copyright",
        pageUrl: "https://archive.org",
        fileUrl: "",
        download: "unavailable",
        reason: "The rights on this copy are not an explicit public-domain or open license, so the file was not saved.",
      },
    ],
  },
];

export default function DiscoverPage({ embedded = false }: { embedded?: boolean }) {
  usePageTitle(embedded ? "Shelf" : "Discover");
  const auth = useAuth();
  const catalogue = useCatalogue();
  const digital = useDigital();
  const live = catalogue.source === "live";
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!live) {
      const needle = query.trim().toLowerCase();
      setGroups(
        sampleGroups
          .map((group) => ({
            ...group,
            results: group.results.filter((hit) => hit.title.toLowerCase().includes(needle) || hit.authors.join(" ").toLowerCase().includes(needle)),
          }))
          .filter((group) => group.results.length > 0),
      );
      return;
    }
    const token = auth.session?.access_token;
    if (!token) return;
    setPending(true);
    try {
      const body = await apiGet<{ groups: Group[] }>(`/api/v1/discovery/search?q=${encodeURIComponent(query.trim())}`, token);
      setGroups(body.groups);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The search did not complete.");
    } finally {
      setPending(false);
    }
  }

  async function save(hit: Hit) {
    if (!live) {
      setMessage("This preview does not save files.");
      return;
    }
    const token = auth.session?.access_token;
    if (!token) return;
    setPending(true);
    setMessage(null);
    try {
      await apiSend("/api/v1/discovery/save", token, "POST", {
        source: hit.source,
        title: hit.title,
        authors: hit.authors,
        rights: hit.rights,
        fileUrl: hit.fileUrl,
      });
      await digital.reload();
      setMessage(`${hit.title} is on your shelf.`);
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "The file was not saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {embedded ? (
        <div className="border-t border-rule pt-8">
          <h2 className="font-serif text-2xl tracking-tight">Outside the library</h2>
          <p className="mt-2 max-w-xl text-sm text-ink-soft">
            {live
              ? "Search Project Gutenberg, Open Library, and the Internet Archive. A file is saved only when that source explicitly permits the download."
              : "This preview shows how an approved result, a metadata-only result, and a closed result appear. Nothing is downloaded."}
          </p>
        </div>
      ) : (
        <PageHeader
          kicker="Discover"
          title="Outside the shelves"
          lede={
            live
              ? "Search Project Gutenberg, Open Library, and the Internet Archive. A file is saved only when that source explicitly permits the download."
              : "This preview shows how an approved result, a metadata-only result, and a closed result appear. Nothing is downloaded."
          }
        />
      )}
      <form className="mt-6 flex max-w-xl flex-wrap gap-3" onSubmit={(event) => void search(event)}>
        <label className="min-w-56 flex-1 text-sm text-ink">
          {embedded ? "Outside search" : "Search"}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-1.5 w-full border border-rule bg-paper-raised px-3 py-2.5 outline-none focus:border-brass"
            placeholder="Title or author"
          />
        </label>
        <Button className="self-end" type="submit" disabled={pending || query.trim().length < 2}>
          {pending ? "Searching" : "Search"}
        </Button>
      </form>
      {message ? <p className="mt-4 max-w-xl text-sm text-ink-soft">{message}</p> : null}
      {groups && groups.every((group) => group.results.length === 0 && !group.error) ? (
        <div className="mt-8">
          <EmptyState title="Nothing matched" detail="Try another title or author." />
        </div>
      ) : null}
      <div className="mt-10 space-y-10">
        {groups?.map((group) => (
          <section key={group.source}>
            <h2 className="font-serif text-2xl tracking-tight">{group.source}</h2>
            {group.error ? <p className="mt-2 text-sm text-ink-soft">{group.error}</p> : null}
            <ul className="mt-4">
              {group.results.map((hit) => {
                const cover = hit.coverUrl || coverFromSource(hit.fileUrl) || coverFromSource(hit.pageUrl);
                return (
                <li key={hit.id} className="flex gap-4 border-t border-rule py-4">
                  {cover ? (
                    <img src={cover} alt="" width={120} height={180} className="h-28 w-[4.5rem] shrink-0 object-cover" />
                  ) : null}
                  <div>
                  <p className="font-serif text-2xl tracking-tight">{hit.title}</p>
                  <p className="mt-1 text-sm text-ink-soft">{hit.authors.join(", ")}</p>
                  {hit.rights ? <p className="mt-2 text-sm text-ink-soft">{hit.rights}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <a href={hit.pageUrl} className="border-b border-brass text-sm text-ink" target="_blank" rel="noreferrer">
                      View at the source
                    </a>
                    {hit.download === "available" ? (
                      <Button type="button" disabled={pending} onClick={() => void save(hit)}>
                        Save to my shelf
                      </Button>
                    ) : (
                      <p className="text-sm text-ink">{hit.reason}</p>
                    )}
                  </div>
                  </div>
                </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
