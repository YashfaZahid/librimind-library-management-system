export function MeterList({
  rows,
}: {
  rows: Array<{ id: string; label: string; value: number; hint: string }>;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul className="space-y-4">
      {rows.map((row) => (
        <li key={row.id}>
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="text-ink">{row.label}</span>
            <span className="font-mono text-xs text-ink-soft">{row.hint}</span>
          </div>
          <div className="mt-2 h-3 bg-rule" aria-hidden="true">
            <div className="h-full bg-binding" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
