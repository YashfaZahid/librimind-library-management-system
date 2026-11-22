import type { DigitalAsset } from "../../domain/digital";
import type { Book, Category } from "../../domain/types";
import { coverImage } from "../books/coverTone";

export interface SpineItem {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string;
  categoryName: string;
  book: Book | null;
  assetId: string | null;
}

export function spineItems(categories: Category[], books: Book[], assets: DigitalAsset[]): SpineItem[] {
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const coverFromFile = new Map<string, string>();
  for (const asset of assets) {
    if (asset.bookId && asset.coverUrl && !coverFromFile.has(asset.bookId)) coverFromFile.set(asset.bookId, asset.coverUrl);
  }
  const catalogue = [...books]
    .sort((left, right) => left.title.localeCompare(right.title))
    .map((book) => ({
      id: book.id,
      title: book.title,
      authors: book.authors,
      coverUrl: coverImage(book) || coverFromFile.get(book.id) || "",
      categoryName: names.get(book.categoryId) ?? "",
      book,
      assetId: null,
    }));
  const known = new Set(books.map((book) => book.id));
  const extra = assets
    .filter((asset) => !asset.bookId || !known.has(asset.bookId))
    .map((asset) => ({
      id: asset.id,
      title: asset.title,
      authors: asset.authors,
      coverUrl: asset.coverUrl ?? "",
      categoryName: asset.scope === "institutional" ? "Library" : "Saved",
      book: null,
      assetId: asset.id,
    }));
  return [...catalogue, ...extra];
}

export function spineWidth(title: string): number {
  const columns = Math.max(1, Math.ceil(title.length / 16));
  return Math.min(76, 20 + columns * 16);
}
