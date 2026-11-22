import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { useAuth } from "../../auth/context";
import { useCatalogue } from "../../data/catalogue";
import { apiSend } from "../../lib/api";
import { usePageTitle } from "../../hooks/usePageTitle";

interface Reply {
  response: string;
}

export default function AssistantPage() {
  usePageTitle("Assistant");
  const auth = useAuth();
  const catalogue = useCatalogue();
  const live = catalogue.source === "live";
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!live) return;
    const token = auth.session?.access_token;
    if (!token) return;
    setPending(true);
    setNotice(null);
    try {
      const body = await apiSend<Reply>("/api/v1/assistant", token, "POST", { message });
      setReply(body);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "The assistant did not answer.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Assistant"
        title="Ask the desk"
        lede={live ? "Ask about a title, a loan, a hold, or what to read next." : "This preview does not run the assistant."}
      />
      <form className="mt-8 max-w-xl" onSubmit={(event) => void ask(event)}>
        <label className="block text-sm text-ink">
          Question
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            className="mt-1.5 w-full border border-rule bg-paper-raised px-3 py-2.5 text-sm font-medium tracking-wide outline-none focus:border-brass"
            placeholder="Find a title, reserve it, or ask what is due"
          />
        </label>
        <Button className="mt-3" type="submit" disabled={pending || message.trim().length < 2}>
          {pending ? "Asking" : "Ask"}
        </Button>
      </form>
      {notice ? <p className="mt-4 max-w-xl text-sm font-medium tracking-wide text-ink-soft">{notice}</p> : null}
      {reply ? <Answer text={reply.response} /> : null}
    </div>
  );
}

const prose = "text-sm font-medium tracking-wide";

function Answer({ text }: { text: string }) {
  const catalogue = useCatalogue();
  const inDesk = useLocation().pathname.startsWith("/admin");
  const books = catalogue.library?.books ?? [];
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const items = lines.filter((line) => line.startsWith("- ")).map((line) => readEntry(line.slice(2)));
  const intro = lines.filter((line) => !line.startsWith("- "));
  if (items.length === 0) {
    return <p className={`mt-16 max-w-3xl text-left leading-relaxed ${prose}`}>{text}</p>;
  }
  return (
    <section className="mt-16 text-left">
      <div className="max-w-3xl space-y-3">
        {intro.map((line) => (
          <p key={line} className={`leading-relaxed text-ink ${prose}`}>
            {line}
          </p>
        ))}
      </div>
      <ul className="mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const book = matchBook(books, item.title);
          const shelf = book ? `${inDesk ? "/admin/shelf" : "/library/shelf"}?book=${book.id}` : "";
          return (
            <li key={item.title + item.detail} className="flex flex-col border border-rule bg-paper-raised px-6 py-5">
              <p className={`text-ink ${prose}`}>{item.title}</p>
              {item.detail ? (
                <p className={`mt-2 leading-relaxed ${prose} ${item.available ? "text-available" : "text-ink-soft"}`}>{item.detail}</p>
              ) : null}
              {item.available && shelf ? (
                <Link to={shelf} className={`mt-5 w-fit border-b border-brass text-ink ${prose}`}>
                  View on shelf
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function readEntry(body: string): { title: string; detail: string; available: boolean } {
  const available = /\bAvailable,/i.test(body);
  const parts = body.split(/\s+-\s+/);
  if (parts.length > 1 && /available|copy|shelf|physical/i.test(parts.slice(1).join(" - "))) {
    return { title: parts[0].trim(), detail: parts.slice(1).join(" - ").trim(), available };
  }
  const cut = body.search(/\s(?:matches|is close|is in the catalogue)\b|\.\s(?:Available|Not available|No physical)/i);
  if (cut > 0) {
    return {
      title: body.slice(0, cut).replace(/\.$/, "").trim(),
      detail: body.slice(cut).replace(/^[\s.—-]+/, "").trim(),
      available,
    };
  }
  return { title: body.trim(), detail: "", available };
}

function matchBook(books: { id: string; title: string }[], title: string) {
  const needle = title.trim().toLowerCase();
  return (
    books.find((book) => book.title.toLowerCase() === needle) ??
    books.find((book) => needle.startsWith(book.title.toLowerCase()) || book.title.toLowerCase().startsWith(needle))
  );
}
