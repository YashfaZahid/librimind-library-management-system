import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookForm } from "../../components/books/BookForm";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { CatalogueNotice } from "../../components/ui/CatalogueNotice";
import { useCatalogue } from "../../data/catalogue";
import { availableCount, booksMatching, categoryById, copiesForBook } from "../../domain/library";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function AdminCataloguePage() {
  usePageTitle("Catalogue");
  const catalogue = useCatalogue();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const library = catalogue.status === "ready" ? catalogue.library : null;
  const books = useMemo(() => booksMatching(library?.books ?? [], query, "all"), [library, query]);
  if (!library) return <CatalogueNotice />;
  const live = catalogue.source === "live";

  return (
    <div>
      <PageHeader
        kicker="Catalogue"
        title="Titles and copies"
        lede={
          live
            ? "Each row counts physical copies in the library. Add a title here, then open it to add copies."
            : "Each row counts physical copies in the sample catalogue. Sign in as a librarian to add records to the database."
        }
      />
      {live ? (
        <div className="mt-8">
          {adding ? (
            <BookForm
              categories={library.categories}
              submitLabel="Add title"
              onSubmit={async (input) => {
                const error = await catalogue.createBook(input);
                if (!error) setAdding(false);
                return error;
              }}
            />
          ) : (
            <Button onClick={() => setAdding(true)}>Add a title</Button>
          )}
        </div>
      ) : null}
      <form className="mt-8" role="search" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="admin-catalogue-search" className="text-sm text-ink">
          Search
        </label>
        <input
          id="admin-catalogue-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Title, author, or ISBN"
          className="mt-1.5 w-full max-w-xl border border-rule bg-paper-raised px-3 py-2.5 outline-none focus:border-brass"
        />
      </form>
      {books.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={live && !query.trim() ? "The catalogue is empty" : "Nothing matches"}
            detail={
              live && !query.trim()
                ? "Add the first title. Subjects are already stored."
                : live
                  ? "No stored title includes that search."
                  : "No sample title includes that search."
            }
          />
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.14em] text-ink-soft">
              <tr>
                <th scope="col" className="py-2 font-medium">Title</th>
                <th scope="col" className="py-2 font-medium">Subject</th>
                <th scope="col" className="py-2 font-medium">Copies</th>
                <th scope="col" className="py-2 font-medium">On shelf</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.id} className="border-t border-rule">
                  <td className="py-3 pr-4">
                    <Link to={`/admin/books/${book.id}`} className="font-serif text-lg text-ink hover:text-binding">
                      {book.title}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-ink-soft">
                    {categoryById(library.categories, book.categoryId)?.name}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">{copiesForBook(library.copies, book.id).length}</td>
                  <td className="py-3 font-mono text-xs">{availableCount(library.copies, book.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
