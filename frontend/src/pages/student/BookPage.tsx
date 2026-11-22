import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/context";
import { useDigital } from "../../data/digital";
import { BookCover } from "../../components/books/BookCover";
import { BookForm } from "../../components/books/BookForm";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatusText } from "../../components/ui/StatusText";
import { TextField } from "../../components/ui/TextField";
import { CatalogueNotice } from "../../components/ui/CatalogueNotice";
import { useCatalogue } from "../../data/catalogue";
import { formatAuthors } from "../../domain/format";
import { availabilityLabel, bookById, categoryById, copiesForBook } from "../../domain/library";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function BookPage() {
  const { bookId = "" } = useParams();
  const inDesk = useLocation().pathname.startsWith("/admin");
  const catalogue = useCatalogue();
  const digital = useDigital();
  const library = catalogue.status === "ready" ? catalogue.library : null;
  const book = library ? bookById(library.books, bookId) : undefined;
  usePageTitle(book?.title ?? "Record");

  if (catalogue.status !== "ready" || !library) return <CatalogueNotice />;
  if (!book) {
    return (
      <EmptyState
        title={catalogue.source === "live" ? "This record is not in the catalogue" : "This record is not in the sample catalogue"}
        detail={
          catalogue.source === "live"
            ? "Open the catalogue and choose a title that is stored in the library."
            : "Open the catalogue and choose a title from the preview collection."
        }
      />
    );
  }

  const category = categoryById(library.categories, book.categoryId)?.name ?? "Uncategorised";
  const copies = copiesForBook(library.copies, book.id);
  const live = catalogue.source === "live";
  const digitalCopy = digital.library?.assets.find((asset) => asset.bookId === book.id && asset.scope === "institutional");

  return (
    <article>
      <p className="text-sm text-ink-soft">
        <Link to={inDesk ? "/admin/shelf" : "/library/shelf"} className="border-b border-brass text-ink">
          Shelf
        </Link>
        <span aria-hidden="true"> · </span>
        <Link to={inDesk ? "/admin" : "/library"} className="border-b border-brass text-ink">
          {inDesk ? "Desk" : "Home"}
        </Link>
      </p>
      <div className="mt-8 grid gap-10 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <BookCover book={book} category={category} size="lg" />
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brass">{category}</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight sm:text-5xl">{book.title}</h1>
          <p className="mt-3 text-lg text-ink-soft">{formatAuthors(book.authors)}</p>
          <p className="mt-6 max-w-2xl leading-relaxed">{book.description}</p>
          <dl className="mt-8 max-w-xl text-sm">
            <Detail term="Year" value={String(book.year || "—")} />
            <Detail term="Publisher" value={book.publisher || "—"} />
            <Detail term="Pages" value={String(book.pages || "—")} />
            <Detail term="ISBN" value={book.isbn13 || "—"} mono />
            <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-t border-rule py-2">
              <dt className="text-ink-soft">On shelf</dt>
              <dd>
                <StatusText>{availabilityLabel(library.copies, book.id)}</StatusText>
              </dd>
            </div>
          </dl>
          {copies.length > 0 ? (
            <ul className="mt-6 max-w-xl text-sm">
              {copies.map((copy) => (
                <li key={copy.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-rule py-2">
                  <span className="font-mono text-xs tracking-wide">{copy.accession}</span>
                  <span className="capitalize text-ink-soft">{copy.status}</span>
                  {live && inDesk && !["borrowed", "reserved"].includes(copy.status) ? (
                    <span className="flex gap-2">
                      {(["available", "maintenance", "lost"] as const)
                        .filter((status) => status !== copy.status)
                        .map((status) => (
                          <CopyStatusButton key={status} copyId={copy.id} status={status} />
                        ))}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {digitalCopy ? (
            <p className="mt-6">
              <Link to={`${inDesk ? `/admin/digital/${digitalCopy.id}` : `/library/digital/${digitalCopy.id}`}?read=1`} className="border-b border-brass text-ink">
                Read the digital copy
              </Link>
            </p>
          ) : null}
          {live ? <KeepBook bookId={book.id} subject={category === "Uncategorised" ? "" : category} /> : null}
          {live && !inDesk ? <ReserveAction bookId={book.id} /> : null}
          {live && inDesk ? <DeskActions bookId={book.id} /> : null}
          {live ? null : (
            <p className="mt-8 max-w-xl text-sm leading-relaxed text-ink-soft">
            Reserving a copy is not saved in this preview. A listed digital copy has no PDF until you sign in.
            </p>
          )}
          {live ? (
            <p className="mt-8 max-w-xl text-sm leading-relaxed text-ink-soft">
              <Link to={inDesk ? "/admin/assistant" : "/library/assistant"} className="border-b border-brass text-ink">
                Ask the assistant about this title
              </Link>
            </p>
          ) : null}
        </div>
      </div>
      {live && inDesk ? (
        <section className="mt-14 max-w-xl border-t border-rule pt-8">
          <h2 className="font-serif text-2xl tracking-tight">Edit this title</h2>
          <div className="mt-6">
            <BookForm
              categories={library.categories}
              book={book}
              submitLabel="Save title"
              onSubmit={(input) => catalogue.updateBook(book.id, input)}
            />
          </div>
        </section>
      ) : null}
    </article>
  );
}

function KeepBook({ bookId, subject }: { bookId: string; subject: string }) {
  const digital = useDigital();
  const auth = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<"shelf" | "interest" | null>(null);
  const saved = digital.library?.shelf.some((item) => item.bookId === bookId) ?? false;
  const interests = auth.profile?.readingInterests ?? [];
  const wanted = subject.trim();
  const already = wanted ? interests.some((item) => item.toLowerCase() === wanted.toLowerCase()) : false;

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Button
        variant="secondary"
        disabled={pending !== null || saved}
        onClick={() => {
          setPending("shelf");
          setMessage(null);
          void digital.saveShelf({ bookId }).then((error) => {
            setMessage(error ?? "Saved on your shelf.");
            setPending(null);
          });
        }}
      >
        {saved ? "On your shelf" : pending === "shelf" ? "Saving" : "Save to my shelf"}
      </Button>
      {wanted && auth.profile ? (
        <Button
          variant="secondary"
          disabled={pending !== null || already}
          onClick={() => {
            if (!auth.profile) return;
            setPending("interest");
            setMessage(null);
            const next = [...interests, wanted].join(", ");
            void auth
              .saveProfile({ fullName: auth.profile.fullName, programme: auth.profile.programme, interests: next })
              .then((error) => {
                setMessage(error ?? `${wanted} is now one of your interests. For you will use it.`);
                setPending(null);
              });
          }}
        >
          {already ? "In your interests" : pending === "interest" ? "Adding" : `Add ${wanted} to interests`}
        </Button>
      ) : null}
      {message ? <p className="w-full text-sm text-ink-soft">{message}</p> : null}
    </div>
  );
}

function ReserveAction({ bookId }: { bookId: string }) {
  const catalogue = useCatalogue();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="mt-8">
      <Button
        disabled={pending}
        onClick={() => {
          setPending(true);
          setMessage(null);
          void catalogue.reserve(bookId).then((error) => {
            setMessage(
              error
                ? { tone: "error", text: error }
                : { tone: "ok", text: "Reservation placed. A librarian issues the copy when it is ready." },
            );
            setPending(false);
          });
        }}
      >
        {pending ? "Reserving" : "Reserve this title"}
      </Button>
      {message ? (
        <p className={message.tone === "error" ? "mt-3 max-w-xl text-sm text-danger" : "mt-3 max-w-xl text-sm text-ink-soft"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

function CopyStatusButton({ copyId, status }: { copyId: string; status: "available" | "maintenance" | "lost" }) {
  const catalogue = useCatalogue();
  const [pending, setPending] = useState(false);
  const label = status === "available" ? "Mark available" : status === "maintenance" ? "Maintenance" : "Mark lost";
  return (
    <Button
      disabled={pending}
      onClick={() => {
        setPending(true);
        void catalogue.setCopyStatus(copyId, status).finally(() => setPending(false));
      }}
    >
      {label}
    </Button>
  );
}

function DeskActions({ bookId }: { bookId: string }) {
  const catalogue = useCatalogue();
  const navigate = useNavigate();
  const [accession, setAccession] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="mt-8 max-w-xl space-y-6">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          setMessage(null);
          void catalogue.addCopy(bookId, accession).then((error) => {
            setMessage(error);
            if (!error) setAccession("");
            setPending(false);
          });
        }}
      >
        <TextField
          className="min-w-48 flex-1"
          label="Accession"
          value={accession}
          onChange={(event) => setAccession(event.target.value)}
          placeholder="LM-2501"
          required
        />
        <Button type="submit" disabled={pending}>
          Add copy
        </Button>
      </form>
      {confirmDelete ? (
        <Button
          variant="secondary"
          onClick={() => {
            setPending(true);
            void catalogue.deleteBook(bookId).then((error) => {
              setPending(false);
              if (error) {
                setMessage(error);
                setConfirmDelete(false);
                return;
              }
              void navigate("/admin/catalogue");
            });
          }}
        >
          Remove this title
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
          Remove title
        </Button>
      )}
      {message ? <p className="text-sm text-danger">{message}</p> : null}
    </div>
  );
}

function Detail({ term, value, mono = false }: { term: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-t border-rule py-2">
      <dt className="text-ink-soft">{term}</dt>
      <dd className={mono ? "font-mono text-xs tracking-wide" : undefined}>{value}</dd>
    </div>
  );
}
