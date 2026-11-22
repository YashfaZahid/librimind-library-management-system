import { Link } from "react-router-dom";
import { CoverThumb } from "../../components/books/CoverThumb";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { DigitalNotice } from "../../components/ui/DigitalNotice";
import { useDigital } from "../../data/digital";
import { formatAuthors, formatFileSize } from "../../domain/format";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function DigitalPage() {
  usePageTitle("Digital library");
  const digital = useDigital();
  if (digital.status !== "ready" || !digital.library) return <DigitalNotice />;
  const live = digital.source === "live";
  const books = digital.library.assets.filter((asset) => asset.scope === "institutional");

  return (
    <div>
      <PageHeader
        kicker="Digital library"
        title={live ? "Files in the library" : "Files in the sample library"}
        lede={
          live
            ? "These PDFs belong to the library. Open one to read it, or keep it on your shelf."
            : "These records show where digital books will appear. The preview does not include the PDF files."
        }
      />
      {books.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No digital books yet" detail="A librarian adds the first PDF from the desk." />
        </div>
      ) : (
        <ul className="mt-10">
          {books.map((asset) => (
            <li key={asset.id} className="flex items-center gap-4 border-t border-rule py-4">
              <CoverThumb id={asset.id} title={asset.title} src={asset.coverUrl ?? ""} />
              <div>
                <Link to={`/library/digital/${asset.id}?read=1`} className="font-serif text-2xl tracking-tight hover:text-binding">
                  {asset.title}
                </Link>
                <p className="mt-1 text-sm text-ink-soft">
                  {formatAuthors(asset.authors)}
                  <span> · PDF · {formatFileSize(asset.fileSize)}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
