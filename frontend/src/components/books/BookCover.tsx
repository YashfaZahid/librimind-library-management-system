import { useState } from "react";
import type { Book } from "../../domain/types";
import { cn } from "../../lib/cn";
import { coverImage, coverTone } from "./coverTone";

const widths = {
  sm: "w-12",
  md: "w-28",
  lg: "w-44",
};

const titleSize = {
  sm: "text-[8px] leading-[1.15]",
  md: "text-sm leading-tight",
  lg: "text-lg leading-tight",
};

export function BookCover({
  book,
  category,
  size = "md",
  className,
}: {
  book: Pick<Book, "id" | "title" | "authors" | "isbn13" | "coverUrl">;
  category?: string;
  size?: keyof typeof widths;
  className?: string;
}) {
  const tone = coverTone(book.id);
  const image = coverImage(book);
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={cn(
        "relative aspect-[2/3] shrink-0 overflow-hidden shadow-[4px_8px_18px_rgba(28,23,20,0.16)] transition-transform duration-200 ease-out hover:-translate-y-1 group-hover:-translate-y-1",
        widths[size],
        className,
      )}
      style={{ backgroundColor: tone.cloth, color: tone.ink }}
    >
      {image && !failed ? (
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : null}
      <span className="absolute inset-y-0 left-0 w-1 bg-black/25" />
      <span className="absolute inset-y-0 left-1 w-px bg-white/25" />
      {image && !failed ? null : (
      <span className="flex h-full flex-col justify-between px-2.5 py-2.5 sm:px-3 sm:py-3">
        <span>
          {category && size !== "sm" ? (
            <span
              className="block text-[9px] font-medium uppercase tracking-[0.16em]"
              style={{ color: tone.rule }}
            >
              {category}
            </span>
          ) : null}
          <span className={cn("mt-1 block font-serif text-balance", titleSize[size], size === "sm" && "line-clamp-5")}>
            {book.title}
          </span>
        </span>
        {size !== "sm" ? <span className="block text-[10px] leading-snug opacity-80">{book.authors[0]}</span> : null}
      </span>
      )}
    </div>
  );
}

