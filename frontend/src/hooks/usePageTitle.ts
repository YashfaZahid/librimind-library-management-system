import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title === "LibriMind" ? title : `${title} · LibriMind`;
  }, [title]);
}
