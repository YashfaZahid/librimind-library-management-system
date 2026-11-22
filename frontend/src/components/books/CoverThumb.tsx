import { useState } from "react";
import { coverTone } from "./coverTone";

export function CoverThumb({
  id,
  src,
  title = "",
  large = false,
}: {
  id: string;
  src: string;
  title?: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const tone = coverTone(id);
  const frame = large ? "h-64 w-44" : "h-24 w-16";
  if (!src || failed) {
    return (
      <span className={`flex shrink-0 items-end p-2 ${frame}`} style={{ backgroundColor: tone.cloth }} aria-hidden>
        {title ? (
          <span className={large ? "font-serif text-2xl leading-tight" : "font-serif text-[10px] leading-tight"} style={{ color: tone.ink }}>
            {title}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={large ? 352 : 128}
      height={large ? 512 : 192}
      className={`${frame} shrink-0 object-cover`}
      onLoad={(event) => {
        if (event.currentTarget.naturalWidth < 20) setFailed(true);
      }}
      onError={() => setFailed(true)}
    />
  );
}
