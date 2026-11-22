import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { CatalogueNotice } from "../../components/ui/CatalogueNotice";
import { useAuth } from "../../auth/context";
import { useCatalogue } from "../../data/catalogue";
import { categoryById, interestBooks } from "../../domain/library";
import { apiGet } from "../../lib/api";
import { usePageTitle } from "../../hooks/usePageTitle";

interface Recommendation {
  bookId: string;
  title: string;
  score: number;
  explanation: string;
  modelVersion: string;
}

export default function RecommendationsPage() {
  usePageTitle("For you");
  const auth = useAuth();
  const catalogue = useCatalogue();
  const live = catalogue.source === "live";
  const [rows, setRows] = useState<Recommendation[]>([]);
  const [model, setModel] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!live) return;
    const token = auth.session?.access_token;
    if (!token) return;
    void apiGet<{ modelVersion: string; recommendations: Recommendation[] }>("/api/v1/recommendations", token)
      .then((body) => {
        setRows(body.recommendations);
        setModel(body.modelVersion);
      })
      .catch((caught: unknown) => setMessage(caught instanceof Error ? caught.message : "Recommendations could not be loaded."));
  }, [auth.session?.access_token, live]);

  if (catalogue.status !== "ready" || !catalogue.library) return <CatalogueNotice />;
  const library = catalogue.library;
  const preview = interestBooks(library, library.sessionReaderId);

  return (
    <div>
      <PageHeader
        kicker="For you"
        title="What to read next"
        lede={
          live
            ? `Scores come from ${model || "tfidf-cosine-v1"}: wording close to titles you have borrowed, plus the subjects on your profile. A current loan is left off the list.`
            : "This preview lists titles in the subjects on the sample profile. The scored model runs after you sign in."
        }
      />
      {message ? <p className="mt-4 text-sm text-ink-soft">{message}</p> : null}
      {live ? (
        rows.length === 0 && !message ? (
          <div className="mt-8">
            <EmptyState title="Nothing to suggest yet" detail="Add a reading interest, or borrow a title, and ask again." />
          </div>
        ) : (
          <ul className="mt-10">
            {rows.map((row) => (
              <li key={row.bookId} className="border-t border-rule py-4">
                <Link to={`/library/books/${row.bookId}`} className="font-serif text-2xl tracking-tight hover:text-binding">
                  {row.title}
                </Link>
                <p className="mt-2 max-w-xl text-sm leading-relaxed">{row.explanation}</p>
                <p className="mt-2 text-sm text-ink-soft">Score {row.score.toFixed(2)}</p>
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="mt-10">
          {preview.map((book) => (
            <li key={book.id} className="border-t border-rule py-4">
              <Link to={`/library/books/${book.id}`} className="font-serif text-2xl tracking-tight hover:text-binding">
                {book.title}
              </Link>
              <p className="mt-2 text-sm text-ink-soft">{categoryById(library.categories, book.categoryId)?.name}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
