import type { ReactNode } from "react";

const tones = [
  "var(--color-binding)",
  "var(--color-brass)",
  "var(--color-available)",
  "var(--color-danger)",
  "var(--color-ink-soft)",
  "var(--color-brass-soft)",
];

export function FigureCard({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-rule bg-paper-raised p-5 sm:p-6">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      {caption ? <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">{caption}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function StatGrid({
  rows,
}: {
  rows: { id: string; label: string; value: string; note?: string }[];
}) {
  return (
    <ul className={`grid gap-6 ${rows.length > 3 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
      {rows.map((row) => (
        <li key={row.id}>
          <p className="font-serif text-4xl tracking-tight text-ink">{row.value}</p>
          <p className="mt-1 text-sm text-ink">{row.label}</p>
          {row.note ? <p className="mt-1 text-xs leading-relaxed text-ink-soft">{row.note}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function RingChart({
  caption,
  rows,
}: {
  caption: string;
  rows: { id: string; label: string; value: number }[];
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let cursor = 0;
  const summary = rows.map((row) => `${row.label} ${formatCount(row.value)}`).join(", ");

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 100 100" className="h-36 w-36 shrink-0" role="img" aria-label={`${caption}. ${summary}`}>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-rule)" strokeWidth="12" />
        <g transform="rotate(-90 50 50)">
          {total > 0
            ? rows.map((row, index) => {
                const length = (row.value / total) * circumference;
                const circle = (
                  <circle
                    key={row.id}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={tones[index % tones.length]}
                    strokeWidth="12"
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={-cursor}
                  />
                );
                cursor += length;
                return circle;
              })
            : null}
        </g>
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-ink font-serif text-[16px]">
          {formatCount(total)}
        </text>
      </svg>
      <ul className="min-w-40 flex-1">
        {rows.map((row, index) => (
          <li key={row.id} className="flex items-baseline justify-between gap-4 border-t border-rule py-2 text-sm first:border-t-0">
            <span className="inline-flex items-center gap-2 text-ink">
              <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: tones[index % tones.length] }} aria-hidden />
              {row.label}
            </span>
            <span className="font-serif text-xl">{formatCount(row.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineChart({
  caption,
  rows,
}: {
  caption: string;
  rows: { id: string; label: string; value: number }[];
}) {
  if (rows.length === 0) return null;
  const width = 320;
  const height = 120;
  const pad = 12;
  const max = Math.max(1, ...rows.map((row) => row.value));
  const points = rows.map((row, index) => {
    const x = rows.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (rows.length - 1);
    const y = height - pad - (row.value / max) * (height - pad * 2);
    return { ...row, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" role="img" aria-label={caption}>
        <path d={path} fill="none" stroke="var(--color-binding)" strokeWidth="2" />
        {points.map((point) => (
          <circle key={point.id} cx={point.x} cy={point.y} r="3.5" fill="var(--color-brass)" />
        ))}
      </svg>
      <div className="mt-2 flex gap-2">
        {points.map((point) => (
          <span key={point.id} className="min-w-0 flex-1 text-center text-xs leading-snug text-ink-soft">
            {point.label}
            <span className="mt-0.5 block font-serif text-base text-ink">{formatCount(point.value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function RankedList({
  rows,
}: {
  rows: { id: string; label: ReactNode; value: number; hint?: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <ol>
      {rows.map((row, index) => (
        <li key={row.id} className="flex items-baseline gap-4 border-t border-rule py-3 first:border-t-0">
          <span className="w-6 shrink-0 font-serif text-brass">{index + 1}</span>
          <div className="min-w-0 flex-1">{row.label}</div>
          <span className="shrink-0 text-right text-sm text-ink-soft">{row.hint ?? formatCount(row.value)}</span>
        </li>
      ))}
    </ol>
  );
}

function formatCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
