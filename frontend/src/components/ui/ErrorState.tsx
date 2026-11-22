import { Button } from "./Button";

export function ErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="max-w-lg border-t border-danger pt-6">
      <h2 className="font-serif text-3xl tracking-tight text-ink">{title}</h2>
      <p className="mt-3 leading-relaxed text-ink-soft">{detail}</p>
      {onRetry ? (
        <Button className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
