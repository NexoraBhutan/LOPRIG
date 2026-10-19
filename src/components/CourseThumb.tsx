import { Book } from "@phosphor-icons/react";
import type { Course } from "@/types";

export default function CourseThumb({
  course,
  className = "",
}: {
  course: Course;
  className?: string;
}) {
  const [c1, c2] = course.gradient ?? ["#ffb606", "#c88e00"];
  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, aspectRatio: "16/9" }}
      role="img"
      aria-label={`${course.title} thumbnail`}
    >
      <Book size={40} weight="duotone" className="text-white/30" />
      <span className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm text-ink-strong text-[0.65rem] font-bold px-2.5 py-1 rounded tracking-wider uppercase">
        {course.category.replace("-", " ")}
      </span>
    </div>
  );
}