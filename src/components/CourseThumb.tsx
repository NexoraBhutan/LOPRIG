import { Book } from "@phosphor-icons/react";
import type { CSSProperties, ReactNode } from "react";
import type { Course } from "@/types";
import { mediaUrl } from "@/lib/api";

/** A course's cover image, or its colour gradient when the teacher hasn't uploaded one. */
export function CoverArt({
  src,
  gradient,
  label,
  className = "",
  style,
  iconSize = 40,
  children,
}: {
  src?: string;
  gradient: [string, string];
  /** Accessible name; leave out when the cover is decorative. */
  label?: string;
  className?: string;
  style?: CSSProperties;
  iconSize?: number;
  children?: ReactNode;
}) {
  const url = mediaUrl(src);
  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
      style={{ background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`, ...style }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        iconSize > 0 && <Book size={iconSize} weight="duotone" className="text-white/30" />
      )}
      {children}
    </div>
  );
}

export default function CourseThumb({
  course,
  className = "",
}: {
  course: Course;
  className?: string;
}) {
  return (
    <CoverArt
      src={course.thumbnail}
      gradient={course.gradient ?? ["#ffb606", "#c88e00"]}
      label={`${course.title} thumbnail`}
      className={className}
      style={{ aspectRatio: "16/9" }}
    >
      <span className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm text-ink-strong text-[0.65rem] font-bold px-2.5 py-1 rounded tracking-wider uppercase">
        {course.category.replace("-", " ")}
      </span>
    </CoverArt>
  );
}
