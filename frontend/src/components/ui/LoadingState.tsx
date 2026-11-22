export function LoadingState({ label = "Loading the library" }: { label?: string }) {
  return (
    <div role="status" className="flex max-w-sm flex-col gap-4 py-8">
      <span className="block h-px w-24 origin-left animate-pulse bg-brass" />
      <p className="text-sm tracking-wide text-ink-soft">{label}</p>
    </div>
  );
}
