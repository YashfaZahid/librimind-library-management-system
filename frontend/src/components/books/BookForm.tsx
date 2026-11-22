import { useState, type FormEvent } from "react";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import type { Book, BookInput, Category } from "../../domain/types";

export function BookForm({
  categories,
  book,
  submitLabel,
  onSubmit,
}: {
  categories: Category[];
  book?: Book;
  submitLabel: string;
  onSubmit: (input: BookInput) => Promise<string | null>;
}) {
  const [title, setTitle] = useState(book?.title ?? "");
  const [authors, setAuthors] = useState(book?.authors.join(", ") ?? "");
  const [categoryId, setCategoryId] = useState(book?.categoryId ?? categories[0]?.id ?? "");
  const [year, setYear] = useState(book ? String(book.year) : "");
  const [publisher, setPublisher] = useState(book?.publisher ?? "");
  const [isbn13, setIsbn13] = useState(book?.isbn13 ?? "");
  const [pages, setPages] = useState(book ? String(book.pages) : "");
  const [description, setDescription] = useState(book?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const names = authors.split(",").map((part) => part.trim()).filter(Boolean);
    if (!title.trim() || names.length === 0 || !categoryId) {
      setError("A title needs a name, at least one author, and a subject.");
      return;
    }
    setPending(true);
    setError(null);
    const message = await onSubmit({
      title: title.trim(),
      authors: names,
      categoryId,
      year: Number(year) || 0,
      publisher: publisher.trim(),
      isbn13: isbn13.trim(),
      pages: Number(pages) || 0,
      description: description.trim(),
    });
    setError(message);
    setPending(false);
  }

  return (
    <form className="grid max-w-xl gap-4" onSubmit={(event) => void submit(event)}>
      <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      <TextField
        label="Authors"
        value={authors}
        onChange={(event) => setAuthors(event.target.value)}
        placeholder="Separate authors with commas"
        required
      />
      <label className="block text-sm text-ink">
        Subject
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="mt-1.5 w-full border border-rule bg-paper-raised px-3 py-2.5 outline-none focus:border-brass"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Year" inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} />
        <TextField label="Pages" inputMode="numeric" value={pages} onChange={(event) => setPages(event.target.value)} />
      </div>
      <TextField label="Publisher" value={publisher} onChange={(event) => setPublisher(event.target.value)} />
      <TextField label="ISBN-13" value={isbn13} onChange={(event) => setIsbn13(event.target.value)} />
      <label className="block text-sm text-ink">
        Description
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          className="mt-1.5 w-full border border-rule bg-paper-raised px-3 py-2.5 outline-none focus:border-brass"
        />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
