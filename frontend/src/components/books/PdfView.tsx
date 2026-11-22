import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

const readerControl =
  "inline-flex cursor-pointer items-center justify-center bg-binding px-4 py-2 text-sm font-medium tracking-wide text-white transition-colors duration-200 hover:bg-[#6a403d] disabled:cursor-not-allowed disabled:opacity-40";

export function PdfView({
  data,
  title,
  notice,
  onClose,
}: {
  data: ArrayBuffer | null;
  title: string;
  notice?: string | null;
  onClose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const task = getDocument({ data: data.slice(0) });
    void task.promise
      .then((loaded) => {
        if (!cancelled) setDoc(loaded);
      })
      .catch(() => {
        if (!cancelled) setError("This PDF could not be drawn.");
      });
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [data]);

  useEffect(() => {
    const surface = stage.current;
    if (!surface) return;
    const measure = () => setBox({ width: surface.clientWidth, height: surface.clientHeight });
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(surface);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [doc]);

  useEffect(() => {
    const surface = canvas.current;
    if (!doc || !surface || box.width < 40 || box.height < 40) return;
    let cancelled = false;
    void doc.getPage(page).then((pdfPage) => {
      if (cancelled) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = Math.min((box.width - 24) / base.width, (box.height - 24) / base.height);
      const viewport = pdfPage.getViewport({ scale: Math.max(scale, 0.2) });
      const context = surface.getContext("2d");
      if (!context) return;
      surface.width = viewport.width;
      surface.height = viewport.height;
      void pdfPage.render({ canvas: surface, canvasContext: context, viewport }).promise.catch(() => {
        if (!cancelled) setError("This PDF could not be drawn.");
      });
    });
    return () => {
      cancelled = true;
    };
  }, [doc, page, box]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (!doc) return;
      if (event.key === "ArrowRight") setPage((current) => Math.min(doc.numPages, current + 1));
      if (event.key === "ArrowLeft") setPage((current) => Math.max(1, current - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc, onClose]);

  const pages = doc?.numPages ?? 0;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-binding-deep text-paper" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          className={readerControl}
          onClick={onClose}
        >
          Close
        </button>
        <p className="text-sm text-[#E7DCCB]">
          {title}
          {pages ? ` · page ${page} of ${pages}` : ""}
        </p>
        <div className="flex gap-2">
          <button type="button" className={readerControl} disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Previous page
          </button>
          <button type="button" className={readerControl} disabled={!pages || page >= pages} onClick={() => setPage((current) => current + 1)}>
            Next page
          </button>
        </div>
      </div>
      <div ref={stage} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 pb-4">
        {notice || error ? <p className="max-w-md text-center text-sm text-[#E7DCCB]">{notice || error}</p> : null}
        {!notice && !error && !doc ? <p className="text-sm text-[#E7DCCB]">Opening the PDF.</p> : null}
        <canvas ref={canvas} className={doc && !notice && !error ? "max-h-full max-w-full bg-white shadow-lg" : "hidden"} />
      </div>
    </div>
  );
}
