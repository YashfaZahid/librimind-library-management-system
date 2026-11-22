import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../auth/context";
import type { LibrarySnapshot } from "../domain/types";
import { apiGet, apiSend } from "../lib/api";
import { sampleLibrary } from "../mocks/sampleLibrary";
import { CatalogueContext, type CatalogueValue } from "./catalogue";

export function CatalogueProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const token = auth.session?.access_token ?? "";
  const live = auth.configured && Boolean(token);
  const [library, setLibrary] = useState<LibrarySnapshot | null>(live ? null : sampleLibrary);
  const [status, setStatus] = useState<CatalogueValue["status"]>(live ? "loading" : "ready");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState(live);

  if (mode !== live) {
    setMode(live);
    setLibrary(live ? null : sampleLibrary);
    setStatus(live ? "loading" : "ready");
    setError(null);
  }

  const reload = useCallback(async () => {
    if (!live) return;
    try {
      const next = await apiGet<LibrarySnapshot>("/api/v1/library", token);
      setLibrary(next);
      setStatus("ready");
      setError(null);
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "The catalogue could not be loaded.");
    }
  }, [live, token]);

  useEffect(() => {
    if (!live) return;
    let ignore = false;
    void (async () => {
      try {
        const next = await apiGet<LibrarySnapshot>("/api/v1/library", token);
        if (ignore) return;
        setLibrary(next);
        setStatus("ready");
        setError(null);
      } catch (caught) {
        if (ignore) return;
        setStatus("error");
        setError(caught instanceof Error ? caught.message : "The catalogue could not be loaded.");
      }
    })();
    return () => {
      ignore = true;
    };
  }, [live, token]);

  const change = useCallback(
    async (path: string, method: string, body?: unknown) => {
      if (!live) return "This preview does not save changes.";
      try {
        await apiSend(path, token, method, body);
        await reload();
        return null;
      } catch (caught) {
        return caught instanceof Error ? caught.message : "The library could not complete that request.";
      }
    },
    [live, reload, token],
  );

  const value = useMemo<CatalogueValue>(
    () => ({
      status,
      source: live ? "live" : "sample",
      library,
      error,
      reload,
      reserve: (bookId) => change("/api/v1/reservations", "POST", { bookId }),
      cancelReservation: (reservationId) => change(`/api/v1/reservations/${reservationId}/cancel`, "POST"),
      approveReservation: (reservationId) => change(`/api/v1/reservations/${reservationId}/approve`, "POST"),
      createBook: (input) => change("/api/v1/books", "POST", input),
      updateBook: (bookId, input) => change(`/api/v1/books/${bookId}`, "PATCH", input),
      deleteBook: (bookId) => change(`/api/v1/books/${bookId}`, "DELETE"),
      addCopy: (bookId, accession) => change(`/api/v1/books/${bookId}/copies`, "POST", { accession }),
      setCopyStatus: (copyId, next) => change(`/api/v1/copies/${copyId}`, "PATCH", { status: next }),
      issue: (email, accession) => change("/api/v1/loans", "POST", { email, accession }),
      returnLoan: (loanId) => change(`/api/v1/loans/${loanId}/return`, "POST"),
      settleFine: (fineId, next) => change(`/api/v1/fines/${fineId}/settle`, "POST", { status: next }),
    }),
    [change, error, library, live, reload, status],
  );

  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}
