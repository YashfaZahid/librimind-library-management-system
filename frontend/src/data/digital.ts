import { createContext, useContext } from "react";
import type { DigitalAsset, DigitalLibrary, UploadInput } from "../domain/digital";
import { sampleDigital } from "../mocks/sampleDigital";

export interface DigitalValue {
  status: "loading" | "ready" | "error";
  source: "sample" | "live";
  library: DigitalLibrary | null;
  error: string | null;
  reload: () => Promise<void>;
  upload: (input: UploadInput) => Promise<{ error: string | null; confirm: boolean }>;
  remove: (assetId: string) => Promise<string | null>;
  saveShelf: (target: { assetId?: string; bookId?: string }) => Promise<string | null>;
  removeShelf: (itemId: string) => Promise<string | null>;
  openFile: (asset: DigitalAsset, download: boolean) => Promise<Blob | null>;
}

const blocked = async () => ({ error: "This preview does not save changes.", confirm: false });

const previewDigital: DigitalValue = {
  status: "ready",
  source: "sample",
  library: sampleDigital,
  error: null,
  reload: async () => undefined,
  upload: blocked,
  remove: async () => "This preview does not save changes.",
  saveShelf: async () => "This preview does not save changes.",
  removeShelf: async () => "This preview does not save changes.",
  openFile: async () => null,
};

export const DigitalContext = createContext<DigitalValue | null>(null);

export function useDigital(): DigitalValue {
  return useContext(DigitalContext) ?? previewDigital;
}
