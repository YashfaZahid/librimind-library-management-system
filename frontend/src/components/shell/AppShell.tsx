import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { Wordmark } from "../brand/Wordmark";
import { SampleBanner } from "../ui/SampleBanner";
import { cn } from "../../lib/cn";

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  hint?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export function AppShell({
  items,
  groups,
  navLabel,
  identity,
  exitLabel = "Leave preview",
  onExit,
  sampleNote = true,
  children,
}: {
  items: NavItem[];
  groups?: NavGroup[];
  navLabel: string;
  identity: { name: string; meta: string };
  exitLabel?: string;
  onExit?: () => void;
  sampleNote?: boolean;
  children: ReactNode;
}) {
  const pathname = useLocation().pathname;
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const open = menuPath === pathname;
  const scroller = useRef<HTMLElement>(null);
  const page = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuPath(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="h-dvh overflow-hidden bg-paper text-ink lg:grid lg:grid-cols-[18.5rem_minmax(0,1fr)]">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      {open ? (
        <button
          className="fixed inset-0 z-30 bg-binding-deep/50 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMenuPath(null)}
        />
      ) : null}
      <aside
        id="primary-navigation"
        ref={scroller}
        className={cn(
          "desk-scroll z-40 min-h-dvh w-64 flex-col bg-binding-deep lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-auto lg:overflow-y-auto",
          open ? "fixed inset-y-0 left-0 flex" : "hidden",
        )}
      >
        <Sidebar
          groups={groups ?? [{ label: "", items }]}
          home={items[0]?.to ?? "/"}
          navLabel={navLabel}
          identity={identity}
          exitLabel={exitLabel}
          onExit={onExit}
        />
        <SideRange scroller={scroller} />
      </aside>
      <div className="relative min-w-0">
        <div ref={page} className="desk-scroll h-dvh overflow-y-auto">
        <header className="flex items-center justify-between border-b border-rule px-4 py-3 lg:hidden">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center bg-binding px-4 py-2 text-sm font-medium tracking-wide text-white transition-colors duration-200 hover:bg-binding-deep"
            aria-expanded={open}
            aria-controls="primary-navigation"
            onClick={() => setMenuPath(pathname)}
          >
            Menu
          </button>
          <Wordmark tone="ink" />
        </header>
        <main id="content" className="px-5 py-8 sm:px-10 lg:px-14 lg:py-12">
          <div className="mx-auto max-w-5xl">
            {sampleNote ? <SampleBanner /> : null}
            <div className={sampleNote ? "mt-8" : undefined}>{children}</div>
          </div>
        </main>
        </div>
        <PageRange scroller={page} />
      </div>
    </div>
  );
}

function Sidebar({
  groups,
  home,
  navLabel,
  identity,
  exitLabel,
  onExit,
}: {
  groups: NavGroup[];
  home: string;
  navLabel: string;
  identity: { name: string; meta: string };
  exitLabel: string;
  onExit?: () => void;
}) {
  return (
    <div className="flex h-full min-h-dvh flex-col px-5 py-8">
      <Link to={home} className="w-fit px-3">
        <Wordmark />
      </Link>
      <nav aria-label={navLabel} className="mt-8 flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group.label || "menu"}>
            {group.label ? (
              <p className="px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-brass-soft">{group.label}</p>
            ) : null}
            <div className={group.label ? "mt-1" : undefined}>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "block border-l px-3 py-2 transition-colors duration-200",
                      isActive
                        ? "border-brass-soft text-brass-soft"
                        : "border-transparent text-[#E7DCCB] hover:text-paper",
                    )
                  }
                >
                  <span className="block text-[15px]">{item.label}</span>
                  {item.hint ? <span className="mt-0.5 block text-xs leading-snug text-[#C4B6A6]">{item.hint}</span> : null}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-auto pt-10">
        <p className="font-serif text-lg text-paper">{identity.name}</p>
        <p className="mt-1 text-sm text-[#C4B6A6]">{identity.meta}</p>
        {onExit ? (
          <button type="button" className={exitClass} onClick={onExit}>
            {exitLabel}
          </button>
        ) : (
          <Link to="/login" className={exitClass}>
            {exitLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

function PageRange({ scroller }: { scroller: RefObject<HTMLElement | null> }) {
  return <Range scroller={scroller} track="bg-rule" thumb="bg-brass" inset={18} />;
}

const exitClass =
  "mt-5 inline-flex cursor-pointer items-center justify-center bg-binding px-4 py-2.5 text-sm font-medium tracking-wide text-white transition-colors duration-200 hover:bg-[#6a403d]";

function SideRange({ scroller }: { scroller: RefObject<HTMLElement | null> }) {
  return <Range scroller={scroller} track="bg-[#E7DCCB]/35" thumb="bg-brass-soft" inset={14} />;
}

function Range({
  scroller,
  track,
  thumb,
  inset,
}: {
  scroller: RefObject<HTMLElement | null>;
  track: string;
  thumb: string;
  inset: number;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const [span, setSpan] = useState({ top: 0, height: 100, overflow: false, box: { top: 0, height: 0, left: 0 } });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const max = el.scrollHeight - el.clientHeight;
      const overflow = max > 8 && rect.width > 40;
      const height = overflow ? Math.max(8, (el.clientHeight / el.scrollHeight) * 100) : 100;
      const top = overflow ? (el.scrollTop / el.scrollHeight) * 100 : 0;
      setSpan({
        top,
        height,
        overflow,
        box: { top: rect.top + 32, height: Math.max(0, rect.height - 64), left: rect.right - inset },
      });
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    const watch = () => {
      measure();
      observer?.observe(el);
      for (const child of el.children) observer?.observe(child);
    };
    watch();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const mutations = new MutationObserver(watch);
    mutations.observe(el, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      observer?.disconnect();
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [inset, scroller]);

  if (!span.overflow) return null;

  function scrollToClient(clientY: number) {
    const el = scroller.current;
    const node = bar.current;
    if (!el || !node) return;
    const rect = node.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = Math.min(max, Math.max(0, ratio * el.scrollHeight - el.clientHeight / 2));
  }

  function drag(event: ReactPointerEvent<HTMLDivElement>) {
    const el = scroller.current;
    const node = bar.current;
    if (!el || !node) return;
    const startY = event.clientY;
    const start = el.scrollTop;
    const height = node.getBoundingClientRect().height;
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => {
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = start + ((next.clientY - startY) / height) * el.scrollHeight;
      if (el.scrollTop < 0) el.scrollTop = 0;
      if (el.scrollTop > max) el.scrollTop = max;
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
      ref={bar}
      className="fixed z-50 w-3 cursor-pointer"
      style={{ top: span.box.top, height: span.box.height, left: span.box.left }}
      onPointerDown={(event) => {
        if (event.target !== bar.current) return;
        scrollToClient(event.clientY);
      }}
      aria-hidden
    >
      <div className={cn("absolute inset-y-0 left-1/2 w-px -translate-x-1/2", track)} />
      <div
        className="absolute left-0 w-full cursor-grab active:cursor-grabbing"
        style={{ top: `${span.top}%`, height: `${span.height}%` }}
        onPointerDown={drag}
      >
        <span className={cn("absolute inset-y-0 left-1/2 w-px -translate-x-1/2", thumb)} />
      </div>
    </div>
  );
}
