import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookRow } from "../../components/books/BookRow";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { CatalogueNotice } from "../../components/ui/CatalogueNotice";
import { useCatalogue } from "../../data/catalogue";
import { booksMatching, categoryById } from "../../domain/library";
import { usePageTitle } from "../../hooks/usePageTitle";
import { cn } from "../../lib/cn";

export default function CataloguePage() {
  usePageTitle("Catalogue");
  const catalogue = useCatalogue();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const library = catalogue.status === "ready" ? catalogue.library : null;
  const books = useMemo(
    () => booksMatching(library?.books ?? [], query, categoryId),
    [library, query, categoryId],
  );
  if (!library) return <CatalogueNotice />;
  const live = catalogue.source === "live";

  return (
    <div>
      <PageHeader
        kicker="Catalogue"
        title={live ? "Every title in the library" : "Every title in the sample collection"}
        lede={
          live
            ? "Search by title, author, or ISBN. Wording search ranks the same catalogue by TF-IDF."
            : "Search by title, author, or ISBN. The list is filtered in the browser from the preview catalogue."
        }
      />
      <form className="mt-8" role="search" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="catalogue-search" className="text-sm text-ink">
          Search
        </label>
        <input
          id="catalogue-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Title, author, or ISBN"
          className="mt-1.5 w-full max-w-xl border border-rule bg-paper-raised px-3 py-2.5 outline-none focus:border-brass"
        />
        <p className="mt-3 text-sm text-ink-soft">
          <Link to="/library/wording" className="border-b border-brass text-ink">
            Search by wording
          </Link>
        </p>
      </form>
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Subject">
        <FilterButton active={categoryId === "all"} onClick={() => setCategoryId("all")}>
          All
        </FilterButton>
        {library.categories.map((category) => (
          <FilterButton
            key={category.id}
            active={categoryId === category.id}
            onClick={() => setCategoryId(category.id)}
          >
            {category.name}
          </FilterButton>
        ))}
      </div>
      {books.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={live && !query.trim() && categoryId === "all" ? "The catalogue is empty" : "Nothing matches"}
            detail={
              live && !query.trim() && categoryId === "all"
                ? "A librarian adds the first title from the desk."
                : live
                  ? "Try another title, author, or subject."
                  : "Try another title, author, or subject. The sample catalogue has twelve books."
            }
          />
        </div>
      ) : (
        <ul className="mt-8">
          {books.map((book) => (
            <BookRow
              key={book.id}
              book={book}
              category={categoryById(library.categories, book.categoryId)?.name ?? "Uncategorised"}
              copies={library.copies}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-sm px-3 py-1.5 text-sm transition-colors duration-200",
        active ? "bg-binding text-paper" : "border border-rule text-ink hover:border-brass",
      )}
    >
      {children}
    </button>
  );
}
