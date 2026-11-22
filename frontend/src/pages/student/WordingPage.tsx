import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { CatalogueNotice } from "../../components/ui/CatalogueNotice";
import { useAuth } from "../../auth/context";
import { useCatalogue } from "../../data/catalogue";
import { apiGet } from "../../lib/api";
import { usePageTitle } from "../../hooks/usePageTitle";

interface Hit {
  bookId: string;
  title: string;
  score: number;
}

export default function WordingPage() {
  usePageTitle("Wording");
  const auth = useAuth();
  const catalogue = useCatalogue();
  const live = catalogue.source === "live";
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!live || !catalogue.library) {
      const words = query.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
      const ranked = (catalogue.library?.books ?? [])
        .map((book) => {
          const haystack = `${book.title} ${book.authors.join(" ")} ${book.description}`.toLowerCase();
          const shared = words.filter((word) => haystack.includes(word)).length;
          return { bookId: book.id, title: book.title, score: words.length ? shared / words.length : 0 };
        })
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
      setHits(ranked);
      setMessage("This preview counts shared words. Signed-in search uses TF-IDF.");
      return;
    }
    const token = auth.session?.access_token;
    if (!token) return;
    try {
      const body = await apiGet<{ results: Hit[] }>(`/api/v1/search/wording?q=${encodeURIComponent(query.trim())}`, token);
      setHits(body.results);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The search did not complete.");
    }
  }

  if (!live && catalogue.status !== "ready") return <CatalogueNotice />;

  return (
    <div>
      <PageHeader
        kicker="Wording"
        title="Search by what a book says"
        lede={
          live
            ? "Titles are ranked by TF-IDF cosine similarity with your words. This is not a keyword filter."
            : "Signed-in search ranks titles with TF-IDF. Here, a result only needs to share a word with the sample text."
        }
      />
      <form className="mt-8 flex max-w-xl flex-wrap gap-3" onSubmit={(event) => void search(event)}>
        <label className="min-w-56 flex-1 text-sm text-ink">
          Words
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-1.5 w-full border border-rule bg-paper-raised px-3 py-2.5 outline-none focus:border-brass"
            placeholder="A phrase from the subject"
          />
        </label>
        <Button className="self-end" type="submit" disabled={query.trim().length < 2}>
          Rank titles
        </Button>
      </form>
      {message ? <p className="mt-4 max-w-xl text-sm text-ink-soft">{message}</p> : null}
      {hits && hits.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Nothing was close" detail="Try words that appear in a title or description." />
        </div>
      ) : null}
      <ul className="mt-8">
        {hits?.map((hit) => (
          <li key={hit.bookId} className="border-t border-rule py-4">
            <Link to={`/library/books/${hit.bookId}`} className="font-serif text-2xl tracking-tight hover:text-binding">
              {hit.title}
            </Link>
            <p className="mt-2 text-sm text-ink-soft">Score {hit.score.toFixed(2)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
