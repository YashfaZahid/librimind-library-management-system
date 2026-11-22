import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { CoverThumb } from "../../components/books/CoverThumb";
import { PdfView } from "../../components/books/PdfView";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { DigitalNotice } from "../../components/ui/DigitalNotice";
import { useDigital } from "../../data/digital";
import { formatAuthors, formatFileSize } from "../../domain/format";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function ReaderPage() {
  const { assetId = "" } = useParams();
  const [params] = useSearchParams();
  const inDesk = useLocation().pathname.startsWith("/admin");
  const digital = useDigital();
  const asset = digital.library?.assets.find((item) => item.id === assetId);
  usePageTitle(asset?.title ?? "Digital book");
  const [file, setFile] = useState<ArrayBuffer | null>(null);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const opened = useRef(false);
  const live = digital.source === "live" && Boolean(asset?.hasFile);

  const load = useCallback(
    async (download: boolean) => {
      if (!asset) return;
      if (!download) {
        setReading(true);
        setFile(null);
      }
      setPending(true);
      setMessage(null);
      try {
        const blob = await digital.openFile(asset, download);
        if (!blob) {
          setMessage("This preview has no PDF. Sign in and upload a file to read it here.");
          return;
        }
        const bytes = await blob.arrayBuffer();
        const head = new TextDecoder().decode(bytes.slice(0, 5));
        if (!head.startsWith("%PDF")) {
          setMessage("The file did not come back as a PDF.");
          return;
        }
        if (download) {
          const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = `${asset.title || "book"}.pdf`;
          link.click();
          URL.revokeObjectURL(url);
        } else {
          setFile(bytes);
        }
      } catch (caught) {
        setMessage(caught instanceof Error ? caught.message : "The file could not be opened.");
      } finally {
        setPending(false);
      }
    },
    [asset, digital],
  );

  useEffect(() => {
    if (opened.current || params.get("read") !== "1" || !live) return;
    opened.current = true;
    void load(false);
  }, [live, load, params]);

  if (digital.status !== "ready" || !digital.library) return <DigitalNotice />;
  if (!asset) {
    return <EmptyState title="This file is not in the library" detail="Open the digital library and choose a PDF." />;
  }

  const saved = digital.library.shelf.some((item) => item.assetId === asset.id);

  return (
    <article>
      <p className="text-sm text-ink-soft">
        <Link to={inDesk ? "/admin/digital" : "/library/digital"} className="border-b border-brass text-ink">
          Digital library
        </Link>
      </p>
      <div className="mt-6 flex flex-wrap items-end gap-6">
        <CoverThumb id={asset.id} title={asset.title} src={asset.coverUrl ?? ""} large />
        <div>
          <h1 className="font-serif text-4xl tracking-tight">{asset.title}</h1>
          <p className="mt-2 text-ink-soft">
            {formatAuthors(asset.authors)} · PDF · {formatFileSize(asset.fileSize)}
          </p>
        </div>
      </div>
      {asset.description ? <p className="mt-4 max-w-2xl leading-relaxed">{asset.description}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button disabled={pending} onClick={() => void load(false)}>
          {pending ? "Opening" : "Read"}
        </Button>
        <Button variant="secondary" disabled={pending || !live} onClick={() => void load(true)}>
          Download
        </Button>
        <Button
          variant="ghost"
          disabled={!live || saved}
          onClick={() => {
            void digital.saveShelf({ assetId: asset.id }).then((error) => setMessage(error));
          }}
        >
          {saved ? "On your shelf" : "Keep on my shelf"}
        </Button>
      </div>
      {message && !reading ? <p className="mt-4 max-w-xl text-sm text-ink-soft">{message}</p> : null}
      {!live ? (
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-ink-soft">
          This preview has no PDF. Sign in and upload a file to read it here.
        </p>
      ) : null}
      {reading ? (
        <PdfView
          data={file}
          title={asset.title}
          notice={message}
          onClose={() => {
            setReading(false);
            setFile(null);
            setMessage(null);
          }}
        />
      ) : null}
    </article>
  );
}
