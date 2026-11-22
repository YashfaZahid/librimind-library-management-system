import { Link } from "react-router-dom";
import { CoverThumb } from "../../components/books/CoverThumb";
import { PdfUploadForm } from "../../components/books/PdfUploadForm";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { DigitalNotice } from "../../components/ui/DigitalNotice";
import { useCatalogue } from "../../data/catalogue";
import { useDigital } from "../../data/digital";
import { formatFileSize } from "../../domain/format";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function AdminDigitalPage() {
  usePageTitle("Digital library");
  const digital = useDigital();
  const catalogue = useCatalogue();
  if (digital.status !== "ready" || !digital.library) return <DigitalNotice />;
  const live = digital.source === "live";
  const books = digital.library.assets.filter((asset) => asset.scope === "institutional");

  return (
    <div>
      <PageHeader
        kicker="Digital library"
        title="Library PDFs"
        lede={
          live
            ? "Upload a PDF into the shared library. A matching file is refused. A matching title asks you to confirm."
            : "Sign in as a librarian to store PDFs. This list is the preview."
        }
      />
      {live && catalogue.library ? (
        <section className="mt-10">
          <PdfUploadForm
            scope="institutional"
            categories={catalogue.library.categories}
            books={catalogue.library.books}
            onUpload={async (input) => {
              const result = await digital.upload(input);
              if (!result.error) await catalogue.reload();
              return result;
            }}
          />
        </section>
      ) : null}
      {books.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No library PDF yet" detail="Upload the first file. It can be a new title or a catalogue title." />
        </div>
      ) : (
        <ul className="mt-10">
          {books.map((asset) => (
            <li key={asset.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-rule py-3">
              <div className="flex items-center gap-4">
                <CoverThumb id={asset.id} title={asset.title} src={asset.coverUrl ?? ""} />
                <div>
                  <Link to={`/admin/digital/${asset.id}?read=1`} className="font-serif text-2xl tracking-tight hover:text-binding">
                    {asset.title}
                  </Link>
                  <p className="mt-1 text-sm text-ink-soft">PDF · {formatFileSize(asset.fileSize)}</p>
                </div>
              </div>
              {live ? (
                <Button onClick={() => void digital.remove(asset.id)}>
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
