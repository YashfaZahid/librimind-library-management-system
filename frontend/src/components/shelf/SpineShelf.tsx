import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { Link } from "react-router-dom";
import { coverTone } from "../books/coverTone";
import { ShelfDetail } from "./ShelfDetail";
import { formatAuthors } from "../../domain/format";
import type { LibrarySnapshot } from "../../domain/types";
import { CoverPlate } from "../books/CoverPlate";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";
import type { SpineItem } from "./spines";

export function SpineShelf({
  items,
  selectedId,
  onSelect,
}: {
  items: SpineItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const reduced = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <div className={cn(reduced && "shelf-still")} role="region" aria-label="Bookshelf">
      <div ref={scroller} className="shelf-scroll overflow-x-auto px-1 pb-2 pt-8">
        <div className="inline-flex min-w-full flex-col">
          <div className="flex items-end gap-1 px-2">
            {items.map((item) => (
              <Spine key={item.id} item={item} selected={item.id === selectedId} onSelect={onSelect} />
            ))}
          </div>
          <div className="mt-1 h-3 bg-binding shadow-[0_10px_18px_rgba(44,27,26,0.28)]" />
          <div className="h-1 bg-binding-deep" />
        </div>
      </div>
      <ShelfRange scroller={scroller} count={items.length} />
    </div>
  );
}

function ShelfRange({ scroller, count }: { scroller: RefObject<HTMLDivElement | null>; count: number }) {
  const track = useRef<HTMLDivElement>(null);
  const [span, setSpan] = useState({ left: 0, width: 100, overflow: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      const overflow = max > 8;
      const width = overflow ? Math.max(14, (el.clientWidth / el.scrollWidth) * 100) : 100;
      const left = overflow ? (el.scrollLeft / el.scrollWidth) * 100 : 0;
      setSpan({ left, width, overflow });
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [scroller, count]);

  if (!span.overflow) return null;

  function scrollToClient(clientX: number) {
    const el = scroller.current;
    const bar = track.current;
    if (!el || !bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const max = el.scrollWidth - el.clientWidth;
    el.scrollLeft = Math.min(max, Math.max(0, ratio * el.scrollWidth - el.clientWidth / 2));
  }

  function drag(event: ReactPointerEvent<HTMLDivElement>) {
    const el = scroller.current;
    const bar = track.current;
    if (!el || !bar) return;
    const startX = event.clientX;
    const start = el.scrollLeft;
    const width = bar.getBoundingClientRect().width;
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => {
      const max = el.scrollWidth - el.clientWidth;
      el.scrollLeft = start + ((next.clientX - startX) / width) * el.scrollWidth;
      if (el.scrollLeft < 0) el.scrollLeft = 0;
      if (el.scrollLeft > max) el.scrollLeft = max;
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  return (
    <div
      ref={track}
      className="relative mx-4 mt-3 h-4 cursor-pointer"
      onPointerDown={(event) => {
        if (event.target !== track.current) return;
        scrollToClient(event.clientX);
      }}
      aria-hidden
    >
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule" />
      <div
        className="absolute top-0 h-full cursor-grab active:cursor-grabbing"
        style={{ width: `${span.width}%`, left: `${span.left}%` }}
        onPointerDown={drag}
      >
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-brass" />
      </div>
    </div>
  );
}

function Spine({
  item,
  selected,
  onSelect,
}: {
  item: SpineItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const tone = coverTone(item.id);
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(item.id)}
      className={cn(
        "group relative h-64 w-[8.25rem] shrink-0 snap-start outline-none hover:z-20 focus-visible:z-20",
        selected && "z-10",
      )}
    >
      <span className={cn("shelf-book absolute bottom-0 left-0 flex h-56 w-[8.25rem]", selected && "is-open")}>
        <span className="relative h-full w-6 shrink-0" style={{ backgroundColor: tone.cloth, color: tone.ink }}>
          <span className="absolute inset-y-0 left-0 w-1 bg-black/35" />
          <span
            className="absolute inset-y-2 left-1.5 right-0.5 overflow-hidden text-left font-serif text-[11px] leading-tight tracking-wide"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {item.title}
          </span>
        </span>
        <span className="relative h-full min-w-0 flex-1 overflow-hidden" style={{ backgroundColor: tone.cloth }}>
          {item.coverUrl && !failed ? (
            <img
              src={item.coverUrl}
              alt=""
              width={240}
              height={360}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
              onLoad={(event) => {
                if (event.currentTarget.naturalWidth < 20) setFailed(true);
              }}
              onError={() => setFailed(true)}
            />
          ) : (
            <CoverPlate title={item.title} authors={item.authors} tone={tone} />
          )}
          <span className="absolute inset-y-0 left-0 w-px bg-black/30" />
        </span>
        <span className="book-fore" />
        <span className="book-body" aria-hidden />
      </span>
    </button>
  );
}

export function BookPop({
  item,
  snapshot,
  onClose,
}: {
  item: SpineItem;
  snapshot: LibrarySnapshot;
  onClose: () => void;
}) {
  const tone = coverTone(item.id);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-binding-deep/45 px-4 py-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
        tabIndex={-1}
        className="book-pop grid max-h-full w-full max-w-3xl gap-8 overflow-y-auto bg-paper p-6 shadow-[0_24px_60px_rgba(26,23,20,0.35)] sm:grid-cols-[15rem_minmax(0,1fr)] sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative mx-auto aspect-[2/3] w-52 overflow-hidden shadow-[8px_16px_28px_rgba(26,23,20,0.22)] sm:w-full" style={{ backgroundColor: tone.cloth }}>
          {item.coverUrl && !failed ? (
            <img
              src={item.coverUrl}
              alt=""
              width={480}
              height={720}
              className="absolute inset-0 h-full w-full object-cover"
              onLoad={(event) => {
                if (event.currentTarget.naturalWidth < 20) setFailed(true);
              }}
              onError={() => setFailed(true)}
            />
          ) : (
            <CoverPlate title={item.title} authors={item.authors} tone={tone} large />
          )}
          <span className="absolute inset-y-0 left-0 w-2 bg-black/25" />
        </div>
        <div>
          <div className="flex justify-end">
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
          {item.book ? (
            <ShelfDetail book={item.book} category={item.categoryName} snapshot={snapshot} />
          ) : (
            <SavedDetail item={item} />
          )}
        </div>
      </div>
    </div>
  );
}

export function SavedDetail({ item }: { item: SpineItem }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-brass">Saved file</p>
      <h2 className="mt-1 font-serif text-3xl tracking-tight">{item.title}</h2>
      <p className="mt-2 text-ink-soft">{formatAuthors(item.authors)}</p>
      {item.assetId ? (
        <Link to={`/library/digital/${item.assetId}?read=1`} className="mt-5 inline-block border-b border-brass text-sm text-ink">
          Open the PDF
        </Link>
      ) : null}
    </div>
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
  }, []);
  return reduced;
}
