import type { LibrarySnapshot } from "./types";

export interface StatusCount {
  status: string;
  count: number;
}

export interface WeekCount {
  week: string;
  loans: number;
}

export interface Activity {
  readers: number;
  withOpenLoan: number;
  withReservation: number;
  openFines: number;
  openFineCents: number;
}

export interface AgentCall {
  agent: string;
  calls: number;
  succeeded: number;
}

export interface AgentRun {
  status: string;
  events: { agent: string; success: boolean }[];
}

export function copyCounts(library: Pick<LibrarySnapshot, "copies">): StatusCount[] {
  const counts = new Map<string, number>();
  for (const copy of library.copies) {
    counts.set(copy.status, (counts.get(copy.status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
}

export function titlesWithoutACopy(library: Pick<LibrarySnapshot, "books" | "copies">): { bookId: string; title: string }[] {
  const held = new Set(library.copies.map((copy) => copy.bookId));
  return library.books
    .filter((book) => !held.has(book.id))
    .map((book) => ({ bookId: book.id, title: book.title }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function titlesWithNoneAvailable(library: Pick<LibrarySnapshot, "books" | "copies">): { bookId: string; title: string }[] {
  return library.books
    .filter((book) => {
      const owned = library.copies.filter((copy) => copy.bookId === book.id);
      return owned.length > 0 && owned.every((copy) => copy.status !== "available");
    })
    .map((book) => ({ bookId: book.id, title: book.title }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function loansByWeek(library: Pick<LibrarySnapshot, "loans">): WeekCount[] {
  const weeks = new Map<string, number>();
  for (const loan of library.loans) {
    const week = weekStart(loan.issuedOn);
    if (!week) continue;
    weeks.set(week, (weeks.get(week) ?? 0) + 1);
  }
  return [...weeks.entries()]
    .map(([week, loans]) => ({ week, loans }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export function readerActivity(library: Pick<LibrarySnapshot, "readers" | "loans" | "reservations" | "fines">): Activity {
  const openLoans = new Set(library.loans.filter((loan) => loan.returnedOn === null).map((loan) => loan.readerId));
  const reserved = new Set(library.reservations.map((reservation) => reservation.readerId));
  const openFines = library.fines.filter((fine) => fine.status === "open");
  return {
    readers: library.readers.length,
    withOpenLoan: openLoans.size,
    withReservation: reserved.size,
    openFines: openFines.length,
    openFineCents: openFines.reduce((sum, fine) => sum + fine.amountCents, 0),
  };
}

export function agentCalls(runs: AgentRun[]): { runs: number; succeeded: number; failed: number; agents: AgentCall[] } {
  const calls = new Map<string, AgentCall>();
  let succeeded = 0;
  let failed = 0;
  for (const run of runs) {
    if (run.status === "succeeded") succeeded += 1;
    if (run.status === "failed") failed += 1;
    for (const event of run.events) {
      const current = calls.get(event.agent) ?? { agent: event.agent, calls: 0, succeeded: 0 };
      current.calls += 1;
      if (event.success) current.succeeded += 1;
      calls.set(event.agent, current);
    }
  }
  return {
    runs: runs.length,
    succeeded,
    failed,
    agents: [...calls.values()].sort((a, b) => b.calls - a.calls || a.agent.localeCompare(b.agent)),
  };
}

function weekStart(value: string): string | null {
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return null;
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}
