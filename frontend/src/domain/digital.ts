export interface DigitalAsset {
  id: string;
  bookId: string | null;
  scope: "institutional" | "personal";
  title: string;
  authors: string[];
  description: string;
  format: "pdf";
  fileSize: number;
  checksum: string;
  createdOn: string;
  hasFile: boolean;
  coverUrl?: string;
}

export interface ShelfItem {
  id: string;
  bookId: string | null;
  assetId: string | null;
  addedOn: string;
}

export interface DigitalLibrary {
  assets: DigitalAsset[];
  shelf: ShelfItem[];
}

export interface UploadInput {
  file: File;
  scope: "institutional" | "personal";
  title: string;
  authors: string;
  description: string;
  categoryId: string;
  bookId: string;
  year: string;
  isbn: string;
  acknowledge: boolean;
}
