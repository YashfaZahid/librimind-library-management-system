import type { Book, Category, Copy, LibrarySnapshot, Loan, Reader, Reservation } from "./types";

export function bookById(books: Book[], id: string): Book | undefined {
  return books.find((book) => book.id === id);
}

export function categoryById(categories: Category[], id: string): Category | undefined {
  return categories.find((category) => category.id === id);
}

export function readerById(readers: Reader[], id: string): Reader | undefined {
  return readers.find((reader) => reader.id === id);
}

export function copyById(copies: Copy[], id: string): Copy | undefined {
  return copies.find((copy) => copy.id === id);
}

export function copiesForBook(copies: Copy[], bookId: string): Copy[] {
  return copies.filter((copy) => copy.bookId === bookId);
}

export function availableCount(copies: Copy[], bookId: string): number {
  return copiesForBook(copies, bookId).filter((copy) => copy.status === "available").length;
}

export function availabilityLabel(copies: Copy[], bookId: string): string {
  const related = copiesForBook(copies, bookId);
  const available = related.filter((copy) => copy.status === "available").length;
  if (related.length === 0) return "No physical copy recorded";
  if (available === 0) return "No copy on the shelf";
  if (available === 1) return "1 copy on the shelf";
  return `${available} copies on the shelf`;
}

export function booksMatching(books: Book[], query: string, categoryId: string | "all"): Book[] {
  const needle = query.trim().toLowerCase();
  return books
    .filter((book) => {
      if (categoryId !== "all" && book.categoryId !== categoryId) return false;
      if (!needle) return true;
      const haystack = [book.title, book.isbn13, ...book.authors].join(" ").toLowerCase();
      return haystack.includes(needle);
    })
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function booksInCategory(books: Book[], categoryId: string): Book[] {
  return books
    .filter((book) => book.categoryId === categoryId)
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function activeLoans(loans: Loan[]): Loan[] {
  return loans.filter((loan) => loan.returnedOn === null);
}

export function returnedLoans(loans: Loan[]): Loan[] {
  return loans
    .filter((loan) => loan.returnedOn !== null)
    .sort((left, right) => (right.returnedOn ?? "").localeCompare(left.returnedOn ?? ""));
}

export function loansForReader(loans: Loan[], readerId: string): Loan[] {
  return loans.filter((loan) => loan.readerId === readerId);
}

export function reservationsForReader(reservations: Reservation[], readerId: string): Reservation[] {
  return reservations.filter((reservation) => reservation.readerId === readerId);
}

export type LoanState = "Overdue" | "Due soon" | "Out" | "Returned";

const DAY_MS = 86_400_000;

export function loanState(loan: Loan, today: string): LoanState {
  if (loan.returnedOn) return "Returned";
  if (loan.dueOn < today) return "Overdue";
  const days = (Date.parse(`${loan.dueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS;
  if (days <= 7) return "Due soon";
  return "Out";
}

export function compareActiveLoans(today: string) {
  const rank = (loan: Loan) => (loanState(loan, today) === "Overdue" ? 0 : 1);
  return (left: Loan, right: Loan) => {
    const byRank = rank(left) - rank(right);
    if (byRank !== 0) return byRank;
    return left.dueOn.localeCompare(right.dueOn);
  };
}

export interface DeskSummary {
  out: number;
  overdue: number;
  openReservations: number;
}

export function deskSummary(snapshot: Pick<LibrarySnapshot, "loans" | "reservations" | "today">): DeskSummary {
  const out = activeLoans(snapshot.loans);
  return {
    out: out.length,
    overdue: out.filter((loan) => loanState(loan, snapshot.today) === "Overdue").length,
    openReservations: snapshot.reservations.length,
  };
}

export function deskSentence(summary: DeskSummary): string {
  return `${countClause(summary.out, "copy", "copies", "out")} ${countClause(summary.overdue, "loan", "loans", "overdue")} ${countClause(summary.openReservations, "reservation", "reservations", "open")}`;
}

function countClause(count: number, singular: string, plural: string, adjective: string): string {
  if (count === 0) return `No ${plural} are ${adjective}.`;
  if (count === 1) return `1 ${singular} is ${adjective}.`;
  return `${count} ${plural} are ${adjective}.`;
}

export function interestBooks(snapshot: LibrarySnapshot, readerId: string): Book[] {
  const reader = readerById(snapshot.readers, readerId);
  if (!reader) return [];
  return snapshot.books
    .filter((book) => reader.interestIds.includes(book.categoryId))
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function interestLabel(snapshot: LibrarySnapshot, readerId: string): string {
  const reader = readerById(snapshot.readers, readerId);
  if (!reader) return "No interests recorded";
  const names = reader.interestIds
    .map((id) => categoryById(snapshot.categories, id)?.name)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return "No interests recorded";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export interface CategoryStock {
  id: string;
  name: string;
  total: number;
  available: number;
}

export function stockByCategory(
  snapshot: Pick<LibrarySnapshot, "categories" | "books" | "copies">,
): CategoryStock[] {
  return snapshot.categories
    .map((category) => {
      const bookIds = new Set(
        snapshot.books.filter((book) => book.categoryId === category.id).map((book) => book.id),
      );
      const related = snapshot.copies.filter((copy) => bookIds.has(copy.bookId));
      return {
        id: category.id,
        name: category.name,
        total: related.length,
        available: related.filter((copy) => copy.status === "available").length,
      };
    })
    .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));
}

export function activeLoanCountForReader(loans: Loan[], readerId: string): number {
  return loansForReader(activeLoans(loans), readerId).length;
}
