import { Link } from "react-router-dom";
import { Wordmark } from "../components/brand/Wordmark";
import { usePageTitle } from "../hooks/usePageTitle";

export default function NotFoundPage() {
  usePageTitle("Not found");
  return (
    <div className="min-h-dvh bg-paper px-6 py-12 text-ink">
      <Wordmark tone="ink" />
      <div className="mx-auto mt-16 max-w-lg">
        <h1 className="font-serif text-4xl tracking-tight">This page is not in the library</h1>
        <p className="mt-4 leading-relaxed text-ink-soft">The address does not match a screen in this preview.</p>
        <p className="mt-6">
          <Link to="/login" className="border-b border-brass">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
