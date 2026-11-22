import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CatalogueNotice } from "../../components/ui/CatalogueNotice";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { BookPop, SpineShelf } from "../../components/shelf/SpineShelf";
import { spineItems } from "../../components/shelf/spines";
import { useAuth } from "../../auth/context";
import { useCatalogue } from "../../data/catalogue";
import { useDigital } from "../../data/digital";
import type { LibrarySnapshot } from "../../domain/types";
import { usePageTitle } from "../../hooks/usePageTitle";
import { apiGet } from "../../lib/api";
import { cn } from "../../lib/cn";
import DiscoverPage from "./DiscoverPage";

export default function BookRoomPage() {
  usePageTitle("Shelf");
  const catalogue = useCatalogue();
  const digital = useDigital();
  const auth = useAuth();
  const [preview, setPreview] = useState<LibrarySnapshot | null>(null);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [params] = useSearchParams();
  const requested = params.get("book");
  const token = auth.session?.access_token ?? "";

  useEffect(() => {
    if (catalogue.library || !token) return;
    let ignore = false;
    void apiGet<LibrarySnapshot>("/api/v1/library?view=shelf", token)
      .then((next) => {
        if (!ignore) setPreview(next);
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, [catalogue.library, token]);

  const library = catalogue.library ?? preview;
  const assets = digital.library?.assets ?? [];
  const items = useMemo(
    () => (library ? spineItems(library.categories, library.books, assets) : []),
    [library, assets],
  );
  const subjects = useMemo(
    () => ["All", ...Array.from(new Set(items.map((item) => item.categoryName).filter(Boolean)))],
    [items],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (subject !== "All" && item.categoryName !== subject) return false;
      if (!needle) return true;
      const haystack = [item.title, item.book?.isbn13 ?? "", item.book?.description ?? "", ...item.authors]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query, subject]);
  useEffect(() => {
    if (requested && items.some((item) => item.id === requested)) setSelectedId(requested);
  }, [items, requested]);
  const selected = visible.find((item) => item.id === selectedId) ?? items.find((item) => item.id === selectedId) ?? null;

  if (!library) return <CatalogueNotice />;

  return (
    <div>
      <PageHeader
        kicker="Shelf"
        title="The book room"
        lede="Search the shelves, then open a book. Its cover comes to the center with the record."
      />
      <form className="mt-8 max-w-xl" role="search" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="shelf-search" className="text-sm text-ink">
          Search
        </label>
        <input
          id="shelf-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Title, author, ISBN, or a phrase from the book"
          className="mt-1.5 w-full border border-rule bg-paper-raised px-3 py-2.5 outline-none focus:border-brass"
        />
      </form>
      <div className="mt-5 flex flex-wrap gap-2">
        {subjects.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={subject === name}
            className={cn(
              "border px-3 py-1 text-sm",
              subject === name ? "border-binding bg-binding text-paper" : "border-rule bg-paper text-ink hover:border-brass",
            )}
            onClick={() => {
              setSubject(name);
              setSelectedId(null);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-soft">
        {visible.length} {visible.length === 1 ? "volume" : "volumes"}
      </p>
      {visible.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Nothing matches" detail="Try another title, author, or subject." />
        </div>
      ) : (
        <div className="mt-4">
          <SpineShelf items={visible} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
        </div>
      )}
      {selected ? <BookPop item={selected} snapshot={library} onClose={() => setSelectedId(null)} /> : null}
      <div className="mt-16">
        <DiscoverPage embedded />
      </div>
    </div>
  );
}
