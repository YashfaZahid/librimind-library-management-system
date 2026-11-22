import { cn } from "../../lib/cn";
import { Mark } from "./Mark";

export function Wordmark({ tone = "paper", className }: { tone?: "paper" | "ink"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark />
      <span
        className={cn(
          "font-serif text-[1.35rem] leading-none tracking-tight",
          tone === "paper" ? "text-paper" : "text-ink",
        )}
      >
        LibriMind
      </span>
    </span>
  );
}
