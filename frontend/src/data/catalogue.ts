import { createContext, useContext } from "react";
import type { BookInput, LibrarySnapshot } from "../domain/types";
import { sampleLibrary } from "../mocks/sampleLibrary";

export interface CatalogueValue {
  status: "loading" | "ready" | "error";
  source: "sample" | "live";
  library: LibrarySnapshot | null;
  error: string | null;
  reload: () => Promise<void>;
  reserve: (bookId: string) => Promise<string | null>;
  cancelReservation: (reservationId: string) => Promise<string | null>;
  approveReservation: (reservationId: string) => Promise<string | null>;
  createBook: (input: BookInput) => Promise<string | null>;
  updateBook: (bookId: string, input: BookInput) => Promise<string | null>;
  deleteBook: (bookId: string) => Promise<string | null>;
  addCopy: (bookId: string, accession: string) => Promise<string | null>;
  setCopyStatus: (copyId: string, status: string) => Promise<string | null>;
  issue: (email: string, accession: string) => Promise<string | null>;
  returnLoan: (loanId: string) => Promise<string | null>;
  settleFine: (fineId: string, status: "paid" | "waived") => Promise<string | null>;
}

const previewBlocked = async () => "This preview does not save changes.";

const previewCatalogue: CatalogueValue = {
  status: "ready",
  source: "sample",
  library: sampleLibrary,
  error: null,
  reload: async () => undefined,
  reserve: previewBlocked,
  cancelReservation: previewBlocked,
  approveReservation: previewBlocked,
  createBook: previewBlocked,
  updateBook: previewBlocked,
  deleteBook: previewBlocked,
  addCopy: previewBlocked,
  setCopyStatus: previewBlocked,
  issue: previewBlocked,
  returnLoan: previewBlocked,
  settleFine: previewBlocked,
};

export const CatalogueContext = createContext<CatalogueValue | null>(null);

export function useCatalogue(): CatalogueValue {
  return useContext(CatalogueContext) ?? previewCatalogue;
}
