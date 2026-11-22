export type CopyStatus = "available" | "borrowed" | "reserved" | "lost" | "maintenance";

export type ReservationStatus = "waiting" | "ready";

export interface Category {
  id: string;
  name: string;
}

export interface Book {
  id: string;
  title: string;
  authors: string[];
  categoryId: string;
  year: number;
  publisher: string;
  isbn13: string;
  pages: number;
  description: string;
  coverUrl?: string;
}

export interface Copy {
  id: string;
  bookId: string;
  accession: string;
  status: CopyStatus;
}

export interface Reader {
  id: string;
  name: string;
  email: string;
  programme: string;
  interestIds: string[];
  interests?: string[];
}

export interface Loan {
  id: string;
  copyId: string;
  readerId: string;
  issuedOn: string;
  dueOn: string;
  returnedOn: string | null;
}

export interface Reservation {
  id: string;
  bookId: string;
  readerId: string;
  status: ReservationStatus;
  placedOn: string;
}

export type FineStatus = "open" | "paid" | "waived";

export interface Fine {
  id: string;
  loanId: string;
  readerId: string;
  amountCents: number;
  reason: string;
  status: FineStatus;
  createdOn: string;
}

export interface BookInput {
  title: string;
  authors: string[];
  categoryId: string;
  year: number;
  publisher: string;
  isbn13: string;
  pages: number;
  description: string;
}

export interface LibrarySnapshot {
  categories: Category[];
  books: Book[];
  copies: Copy[];
  readers: Reader[];
  loans: Loan[];
  reservations: Reservation[];
  fines: Fine[];
  today: string;
  sessionReaderId: string;
}
