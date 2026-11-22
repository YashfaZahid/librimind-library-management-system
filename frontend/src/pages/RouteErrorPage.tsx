import { useRouteError } from "react-router-dom";
import { Wordmark } from "../components/brand/Wordmark";
import { ErrorState } from "../components/ui/ErrorState";

export default function RouteErrorPage() {
  const error = useRouteError();
  const detail = error instanceof Error ? error.message : "The page could not be opened.";

  return (
    <div className="min-h-dvh bg-paper px-6 py-12 text-ink">
      <Wordmark tone="ink" />
      <div className="mx-auto mt-16 max-w-lg">
        <ErrorState title="Something went wrong" detail={detail} onRetry={() => window.location.assign("/login")} />
      </div>
    </div>
  );
}
