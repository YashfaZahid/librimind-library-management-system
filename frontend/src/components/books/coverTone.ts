const TONES = [
  { cloth: "#3F2A28", ink: "#F6F1E8", rule: "#C4A574" },
  { cloth: "#1E2A2E", ink: "#F6F1E8", rule: "#C4A574" },
  { cloth: "#E7D3B4", ink: "#2C1B1A", rule: "#8C3A3A" },
  { cloth: "#243028", ink: "#F3EEE4", rule: "#D7C4A3" },
  { cloth: "#F7F3EC", ink: "#2C1B1A", rule: "#8C6A3D" },
  { cloth: "#5A2E32", ink: "#F6F1E8", rule: "#E4C98A" },
] as const;

export function coverFromSource(url: string): string {
  const gutenberg = url.match(/gutenberg\.org\/(?:files|ebooks|cache\/epub)\/(\d+)/);
  if (gutenberg?.[1]) {
    return `https://www.gutenberg.org/cache/epub/${gutenberg[1]}/pg${gutenberg[1]}.cover.medium.jpg`;
  }
  const archive = url.match(/archive\.org\/(?:download|details)\/([^/?#]+)/);
  if (archive?.[1]) return `https://archive.org/services/img/${archive[1]}`;
  return "";
}

export function coverImage(book: { isbn13?: string; coverUrl?: string }): string {
  if (book.coverUrl) return book.coverUrl;
  const isbn = (book.isbn13 ?? "").replace(/[^0-9Xx]/g, "");
  if (isbn.length === 10 || isbn.length === 13) return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
  return "";
}

export function coverTone(id: string): (typeof TONES)[number] {
  let total = 0;
  for (const char of id) total += char.charCodeAt(0);
  return TONES[total % TONES.length] ?? TONES[0];
}
