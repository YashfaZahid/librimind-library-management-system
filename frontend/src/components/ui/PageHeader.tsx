export function PageHeader({ kicker, title, lede }: { kicker?: string; title: string; lede?: string }) {
  return (
    <header>
      {kicker ? <p className="text-xs font-medium uppercase tracking-[0.2em] text-brass">{kicker}</p> : null}
      <h1 className={cnTitle(Boolean(kicker))}>{title}</h1>
      {lede ? <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">{lede}</p> : null}
    </header>
  );
}

function cnTitle(hasKicker: boolean): string {
  return hasKicker
    ? "mt-2 font-serif text-4xl tracking-tight text-ink sm:text-5xl"
    : "font-serif text-4xl tracking-tight text-ink sm:text-5xl";
}
