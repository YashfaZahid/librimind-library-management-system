export function CoverPlate({
  title,
  authors,
  tone,
  large = false,
}: {
  title: string;
  authors: string[];
  tone: { cloth: string; ink: string; rule: string };
  large?: boolean;
}) {
  const author = authors.filter(Boolean)[0] ?? "";
  return (
    <span className="flex h-full flex-col justify-between p-2.5" style={{ backgroundColor: tone.cloth, color: tone.ink }}>
      <span className="h-px w-10" style={{ backgroundColor: tone.rule }} />
      <span className={large ? "font-serif text-3xl leading-tight" : "font-serif text-[13px] leading-snug"}>{title}</span>
      <span>
        <span className="block h-px w-full" style={{ backgroundColor: tone.rule }} />
        {author ? (
          <span className={large ? "mt-2 block text-sm" : "mt-1 block truncate text-[10px] uppercase tracking-wide"}>{author}</span>
        ) : null}
      </span>
    </span>
  );
}
