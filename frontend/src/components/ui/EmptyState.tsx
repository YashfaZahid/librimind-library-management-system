export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="border-t border-rule py-10">
      <h2 className="font-serif text-2xl tracking-tight text-ink">{title}</h2>
      <p className="mt-2 max-w-md leading-relaxed text-ink-soft">{detail}</p>
    </div>
  );
}
