import { Link } from "react-router-dom";
import { PdfUploadForm } from "../../components/books/PdfUploadForm";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { DigitalNotice } from "../../components/ui/DigitalNotice";
import { useCatalogue } from "../../data/catalogue";
import { useDigital } from "../../data/digital";
import { CoverThumb } from "../../components/books/CoverThumb";
import { coverImage } from "../../components/books/coverTone";
import { formatAuthors, formatFileSize } from "../../domain/format";
import { bookById } from "../../domain/library";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function CollectionPage() {
  usePageTitle("My shelf");
  const digital = useDigital();
  const catalogue = useCatalogue();
  if (digital.status !== "ready" || !digital.library) return <DigitalNotice />;
  const live = digital.source === "live";
  const mine = digital.library.assets.filter((asset) => asset.scope === "personal");
  const books = catalogue.library?.books ?? [];

  return (
    <div>
      <PageHeader
        kicker="Personal collection"
        title="My shelf"
        lede={
          live
            ? "Add a PDF of your own, or save a title from its record. Both stay on your account."
            : "The sample shelf shows one personal file. Nothing here is saved."
        }
      />
      <section className="mt-12">
        <h2 className="font-serif text-2xl tracking-tight">My files</h2>
        {live && catalogue.library ? (
          <div className="mt-6">
            <PdfUploadForm
              scope="personal"
              categories={catalogue.library.categories}
              books={[]}
              onUpload={(input) => digital.upload(input)}
            />
          </div>
        ) : null}
        {mine.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No personal file yet" detail={live ? "Choose a PDF above. It stays on your account." : "Save a permitted book from the shelf and it will appear here."} />
          </div>
        ) : (
          <ul className="mt-4">
            {mine.map((asset) => {
              const linked = asset.bookId ? bookById(books, asset.bookId) : undefined;
              return (
              <li key={asset.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-rule py-3">
                <div className="flex items-center gap-4">
                  <CoverThumb id={asset.id} title={asset.title} src={asset.coverUrl || (linked ? coverImage(linked) : "")} />
                  <div>
                  <Link to={`/library/digital/${asset.id}?read=1`} className="font-serif text-xl hover:text-binding">
                    {asset.title}
                  </Link>
                  <p className="mt-1 text-sm text-ink-soft">
                    {formatAuthors(asset.authors)} · {formatFileSize(asset.fileSize)}
                  </p>
                  </div>
                </div>
                {live ? (
                  <Button onClick={() => void digital.remove(asset.id)}>
                    Remove
                  </Button>
                ) : null}
              </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="mt-12">
        <h2 className="font-serif text-2xl tracking-tight">Kept from the library</h2>
        {digital.library.shelf.length === 0 ? (
          <p className="mt-4 border-t border-rule pt-4 text-sm text-ink-soft">Nothing is kept on this shelf.</p>
        ) : (
          <ul className="mt-4">
            {digital.library.shelf.map((item) => {
              const asset = digital.library?.assets.find((entry) => entry.id === item.assetId);
              const book = item.bookId ? bookById(books, item.bookId) : undefined;
              const label = asset?.title || book?.title;
              if (!label) return null;
              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-rule py-3">
                  <div className="flex items-center gap-4">
                    <CoverThumb
                      id={asset?.id || book?.id || item.id}
                      title={label}
                      src={asset?.coverUrl || (book ? coverImage(book) : "")}
                    />
                    {asset ? (
                    <Link to={`/library/digital/${asset.id}?read=1`} className="font-serif text-xl hover:text-binding">
                      {label}
                    </Link>
                  ) : (
                    <Link to={`/library/books/${item.bookId}`} className="font-serif text-xl hover:text-binding">
                      {label}
                    </Link>
                  )}
                  </div>
                  {live ? (
                    <Button onClick={() => void digital.removeShelf(item.id)}>
                      Remove
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
