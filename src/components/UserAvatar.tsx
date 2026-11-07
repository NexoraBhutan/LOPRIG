"use client";

import { useState } from "react";
import { mediaUrl } from "@/lib/api";

/** A person's photo (uploaded, or from their Google account), or their initial on their colour. */
export default function UserAvatar({
  name,
  src,
  color,
  className = "w-9 h-9 text-xs",
  textColor = "text-white",
}: {
  name: string;
  src?: string | null;
  color?: string;
  /** Size and font size, e.g. "w-24 h-24 text-3xl". */
  className?: string;
  /** Colour of the initial, for light backgrounds. */
  textColor?: string;
}) {
  const url = mediaUrl(src);
  // If the photo can't load (removed, expired link, offline), fall back to the initial.
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = url && failed !== url;

  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 font-bold ${textColor} ${className}`}
      style={{ background: color || "#1a1a1a" }}
      aria-hidden="true"
    >
      {showPhoto ? (
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover"
          // Google's image server refuses some requests that carry a Referer header.
          referrerPolicy="no-referrer"
          onError={() => setFailed(url)}
        />
      ) : (
        (name.trim().charAt(0) || "?").toUpperCase()
      )}
    </span>
  );
}
