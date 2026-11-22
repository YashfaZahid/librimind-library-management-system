import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../auth/context";
import type { DigitalAsset, DigitalLibrary, UploadInput } from "../domain/digital";
import { ApiError, apiFile, apiGet, apiSend, apiUpload } from "../lib/api";
import { sampleDigital } from "../mocks/sampleDigital";
import { DigitalContext, type DigitalValue } from "./digital";

export function DigitalProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const token = auth.session?.access_token ?? "";
  const live = auth.configured && Boolean(token);
  const [library, setLibrary] = useState<DigitalLibrary | null>(live ? null : sampleDigital);
  const [status, setStatus] = useState<DigitalValue["status"]>(live ? "loading" : "ready");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState(live);

  if (mode !== live) {
    setMode(live);
    setLibrary(live ? null : sampleDigital);
    setStatus(live ? "loading" : "ready");
    setError(null);
  }

  const reload = useCallback(async () => {
    if (!live) return;
    try {
      const next = await apiGet<DigitalLibrary>("/api/v1/digital", token);
      setLibrary(next);
      setStatus("ready");
      setError(null);
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "The digital library could not be loaded.");
    }
  }, [live, token]);

  useEffect(() => {
    if (!live) return;
    let ignore = false;
    void (async () => {
      try {
        const next = await apiGet<DigitalLibrary>("/api/v1/digital", token);
        if (ignore) return;
        setLibrary(next);
        setStatus("ready");
        setError(null);
      } catch (caught) {
        if (ignore) return;
        setStatus("error");
        setError(caught instanceof Error ? caught.message : "The digital library could not be loaded.");
      }
    })();
    return () => {
      ignore = true;
    };
  }, [live, token]);

  const upload = useCallback(
    async (input: UploadInput) => {
      if (!live) return { error: "This preview does not save changes.", confirm: false };
      const form = new FormData();
      form.set("file", input.file);
      form.set("scope", input.scope);
      form.set("title", input.title);
      form.set("authors", input.authors);
      form.set("description", input.description);
      form.set("categoryId", input.categoryId);
      form.set("bookId", input.bookId);
      form.set("year", input.year || "0");
      form.set("isbn", input.isbn);
      form.set("acknowledge", input.acknowledge ? "true" : "false");
      try {
        await apiUpload<DigitalAsset>("/api/v1/digital", token, form);
        await reload();
        return { error: null, confirm: false };
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 409) return { error: caught.message, confirm: true };
        return {
          error: caught instanceof Error ? caught.message : "The file could not be saved.",
          confirm: false,
        };
      }
    },
    [live, reload, token],
  );

  const remove = useCallback(
    async (assetId: string) => {
      if (!live) return "This preview does not save changes.";
      try {
        await apiSend(`/api/v1/digital/${assetId}`, token, "DELETE");
        await reload();
        return null;
      } catch (caught) {
        return caught instanceof Error ? caught.message : "The file could not be removed.";
      }
    },
    [live, reload, token],
  );

  const saveShelf = useCallback(
    async (target: { assetId?: string; bookId?: string }) => {
      if (!live) return "This preview does not save changes.";
      try {
        await apiSend("/api/v1/shelf", token, "POST", { assetId: target.assetId ?? "", bookId: target.bookId ?? "" });
        await reload();
        return null;
      } catch (caught) {
        return caught instanceof Error ? caught.message : "The shelf could not be updated.";
      }
    },
    [live, reload, token],
  );

  const removeShelf = useCallback(
    async (itemId: string) => {
      if (!live) return "This preview does not save changes.";
      try {
        await apiSend(`/api/v1/shelf/${itemId}`, token, "DELETE");
        await reload();
        return null;
      } catch (caught) {
        return caught instanceof Error ? caught.message : "The shelf could not be updated.";
      }
    },
    [live, reload, token],
  );

  const openFile = useCallback(
    async (asset: DigitalAsset, download: boolean) => {
      if (!live || !asset.hasFile) return null;
      return apiFile(`/api/v1/digital/${asset.id}/file?download=${download ? "true" : "false"}`, token);
    },
    [live, token],
  );

  const value = useMemo<DigitalValue>(
    () => ({
      status,
      source: live ? "live" : "sample",
      library,
      error,
      reload,
      upload,
      remove,
      saveShelf,
      removeShelf,
      openFile,
    }),
    [error, library, live, openFile, reload, remove, removeShelf, saveShelf, status, upload],
  );

  return <DigitalContext.Provider value={value}>{children}</DigitalContext.Provider>;
}
