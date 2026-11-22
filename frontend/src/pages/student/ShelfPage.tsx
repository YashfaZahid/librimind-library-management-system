import { Link } from "react-router-dom";
import { BookCover } from "../../components/books/BookCover";
import { PageHeader } from "../../components/ui/PageHeader";
import { CatalogueNotice } from "../../components/ui/CatalogueNotice";
import { useCatalogue } from "../../data/catalogue";
import { booksInCategory } from "../../domain/library";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function ShelfPage() {
  usePageTitle("Stacks");
  const catalogue = useCatalogue();
  if (catalogue.status !== "ready" || !catalogue.library) return <CatalogueNotice />;
  const library = catalogue.library;
  const live = catalogue.source === "live";

  return (
    <div>
      <PageHeader
        kicker="Stacks"
        title="Browse by subject"
        lede={
          live
            ? "These shelves group the library by subject. The book room uses the same records."
            : "These shelves are the sample catalogue, grouped for browsing. The book room uses the same records."
        }
      />
      <div className="mt-12 space-y-12">
        {library.categories.map((category) => {
          const books = booksInCategory(library.books, category.id);
          return (
            <section key={category.id} aria-labelledby={`shelf-${category.id}`}>
              <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
                <h2 id={`shelf-${category.id}`} className="font-serif text-3xl tracking-tight">
                  {category.name}
                </h2>
                <p className="text-sm text-ink-soft">{books.length} titles</p>
              </div>
              <ul className="mt-5 flex gap-5 overflow-x-auto pb-3">
                {books.map((book) => (
                  <li key={book.id}>
                    <Link to={`/library/books/${book.id}`} className="group block w-28">
                      <BookCover book={book} category={category.name} size="md" />
                      <span className="mt-3 block font-serif text-sm leading-snug group-hover:text-binding">
                        {book.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
