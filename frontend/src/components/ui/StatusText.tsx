import { cn } from "../../lib/cn";

export function StatusText({ children }: { children: string }) {
  return <span className={cn("text-sm", tone(children))}>{children}</span>;
}

function tone(value: string): string {
  if (value === "Overdue") return "text-danger";
  if (value === "Due soon" || value === "Ready" || value === "Waiting") return "text-brass";
  if (/^\d+ cop(y|ies) on the shelf$/.test(value)) return "text-available";
  return "text-ink-soft";
}
