import { useState } from "react";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import type { UploadInput } from "../../domain/digital";
import type { Book, Category } from "../../domain/types";

export function PdfUploadForm({
  scope,
  categories,
  books,
  onUpload,
}: {
  scope: "institutional" | "personal";
  categories: Category[];
  books: Book[];
  onUpload: (input: UploadInput) => Promise<{ error: string | null; confirm: boolean }>;
}) {
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [bookId, setBookId] = useState("");
  const [year, setYear] = useState("");
  const [isbn, setIsbn] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);

  function chooseBook(nextId: string) {
    setBookId(nextId);
    const book = books.find((item) => item.id === nextId);
    if (!book) {
      setIsbn("");
      return;
    }
    setTitle(book.title);
    setAuthors(book.authors.join(", "));
    setDescription(book.description);
    setCategoryId(book.categoryId);
    setYear(String(book.year || ""));
    setIsbn(book.isbn13 ?? "");
  }

  async function submit(acknowledge: boolean) {
    if (!file) {
      setMessage("Choose a PDF file.");
      return;
    }
    if (!title.trim()) {
      setMessage("A digital book needs a title.");
      return;
    }
    setPending(true);
    const result = await onUpload({
      file,
      scope,
      title: title.trim(),
      authors,
      description,
      categoryId: bookId ? "" : categoryId,
      bookId,
      year,
      isbn: isbn.trim(),
      acknowledge,
    });
    setPending(false);
    setConfirm(result.confirm);
    setMessage(result.error ?? "The PDF is saved.");
    if (!result.error) {
      setFile(null);
      setTitle("");
      setAuthors("");
      setDescription("");
      setBookId("");
      setYear("");
      setIsbn("");
    }
  }

  return (
    <form
      className="grid max-w-xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(false);
      }}
    >
      <label className="block text-sm text-ink">
        PDF
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="mt-1.5 block w-full text-sm"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setConfirm(false);
          }}
        />
      </label>
      {scope === "institutional" && books.length > 0 ? (
        <label className="block text-sm text-ink">
          Link to a catalogue title
          <select
            value={bookId}
            onChange={(event) => chooseBook(event.target.value)}
            className="mt-1.5 w-full border border-rule bg-paper-raised px-3 py-2.5 outline-none focus:border-brass"
          >
            <option value="">New title</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      <TextField
        label="Authors"
        value={authors}
        onChange={(event) => setAuthors(event.target.value)}
        placeholder="Separate authors with commas"
      />
      {scope === "institutional" && !bookId ? (
        <>
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
          <TextField label="Year" inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} />
          <TextField label="ISBN" value={isbn} onChange={(event) => setIsbn(event.target.value)} placeholder="Fills the shelf cover" />
        </>
      ) : null}
      <label className="block text-sm text-ink">
        Description
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="mt-1.5 w-full border border-rule bg-paper-raised px-3 py-2.5 outline-none focus:border-brass"
        />
      </label>
      {message ? <p className={confirm ? "text-sm text-ink" : "text-sm text-ink-soft"}>{message}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : "Save PDF"}
        </Button>
        {confirm ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => void submit(true)}>
            Save this file anyway
          </Button>
        ) : null}
      </div>
    </form>
  );
}
