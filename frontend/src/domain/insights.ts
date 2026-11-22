import type { LibrarySnapshot } from "./types";

export interface CountedTitle {
  bookId: string;
  title: string;
  count: number;
}

export interface ForecastTitle {
  bookId: string;
  title: string;
  projectedLoans: number;
  available: number;
  shortfall: number;
}

export function popularity(library: LibrarySnapshot): CountedTitle[] {
  return counted(library, () => 0).filter((row) => row.count > 0);
}

export function demand(library: LibrarySnapshot): CountedTitle[] {
  const rows = counted(library, () => 0);
  for (const reservation of library.reservations) {
    if (reservation.status !== "waiting" && reservation.status !== "ready") continue;
    const row = rows.find((item) => item.bookId === reservation.bookId);
    if (row) row.count += 1;
  }
  return rows.filter((row) => row.count > 0).sort(byCount);
}

export function forecast(library: LibrarySnapshot): { method: string; check: string; titles: ForecastTitle[] } {
  const dates = library.loans.map((loan) => loan.issuedOn).filter(Boolean).sort();
  const weeks = dates.length ? Math.max(daysBetween(dates[0], dates[dates.length - 1]), 7) / 7 : 0;
  const titles = library.books
    .map((book) => {
      const loans = library.loans.filter((loan) => copyBook(library, loan.copyId) === book.id).length;
      const available = library.copies.filter((copy) => copy.bookId === book.id && copy.status === "available").length;
      const projected = weeks ? (loans / weeks) * 4 : 0;
      const shortfall = Math.max(0, Math.ceil(projected - available));
      return { bookId: book.id, title: book.title, projectedLoans: round2(projected), available, shortfall, loans };
    })
    .filter((row) => row.loans > 0 || row.shortfall > 0)
    .sort((a, b) => b.shortfall - a.shortfall || b.projectedLoans - a.projectedLoans || a.title.localeCompare(b.title));
  return {
    method: "Projected loans are that title's average loans per week, multiplied by 4. A shortfall is that number minus the copies available now.",
    check: forecastCheck(dates),
    titles,
  };
}

function counted(library: LibrarySnapshot, extra: () => number): CountedTitle[] {
  return library.books
    .map((book) => ({
      bookId: book.id,
      title: book.title,
      count: library.loans.filter((loan) => copyBook(library, loan.copyId) === book.id).length + extra(),
    }))
    .sort(byCount);
}

function copyBook(library: LibrarySnapshot, copyId: string): string | undefined {
  return library.copies.find((copy) => copy.id === copyId)?.bookId;
}

function byCount(a: CountedTitle, b: CountedTitle): number {
  return b.count - a.count || a.title.localeCompare(b.title);
}

function daysBetween(start: string, end: string): number {
  const from = Date.parse(`${start.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${end.slice(0, 10)}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function forecastCheck(dates: string[]): string {
  const weeks = new Map<string, number>();
  for (const value of dates) {
    const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(day.getTime())) continue;
    const monday = new Date(day);
    monday.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    weeks.set(key, (weeks.get(key) ?? 0) + 1);
  }
  const ordered = [...weeks.keys()].sort().map((key) => weeks.get(key) ?? 0);
  if (ordered.length < 2) return "Not enough weeks of loans to check the forecast.";
  const earlier = ordered.slice(0, -1).reduce((sum, count) => sum + count, 0) / (ordered.length - 1);
  return `The latest week had ${ordered[ordered.length - 1]} loans. The average of the earlier weeks was ${earlier.toFixed(1)}.`;
}
