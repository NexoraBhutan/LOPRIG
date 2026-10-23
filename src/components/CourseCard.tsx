"use client";

import Link from "next/link";
import { Clock, Users, Heart, ChartBar } from "@phosphor-icons/react";
import type { Course } from "@/types";
import CourseThumb from "@/components/CourseThumb";
import Rating from "@/components/Rating";
import { useEnrollment } from "@/context/EnrollmentContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export default function CourseCard({ course }: { course: Course }) {
  const { toggleSaved, enrollments } = useEnrollment();
  const { user } = useAuth();
  const { push } = useToast();
  const saved = Boolean(enrollments[course.id]?.saved);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      push("Log in to save courses to your list.", "info");
      return;
    }
    try {
      await toggleSaved(course.id);
      push(saved ? "Removed from saved courses" : "Saved to your list", "success");
    } catch {
      push("Couldn't update your saved courses. Please try again.", "error");
    }
  };

  return (
    <Link href={`/courses/${course.id}`} className="group block rounded-xl overflow-hidden bg-white border-2 border-line hover:border-gold hover:shadow-[0_8px_32px_rgba(255,182,6,0.1)] transition-all duration-300 hover:-translate-y-1">
      <div className="relative overflow-hidden">
        <CourseThumb course={course} />
        {course.bestseller && (
          <span className="absolute top-3 left-3 bg-gold text-ink-strong text-[0.65rem] font-bold px-3 py-1 rounded-[4px] tracking-wider uppercase">
            Bestseller
          </span>
        )}
        <button
          className={`absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center transition-all hover:scale-110 ${saved ? "text-red" : "text-ink-muted hover:text-red"}`}
          onClick={handleSave}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved courses" : "Save course"}
        >
          <Heart size={18} weight={saved ? "fill" : "regular"} />
        </button>
      </div>
      <div className="p-5">
        <span className="text-[0.7rem] font-bold text-gold-dark uppercase tracking-wider">{course.category.replace("-", " ")}</span>
        <h3 className="text-sm font-semibold text-ink-strong mt-1.5 mb-1 leading-snug line-clamp-2">{course.title}</h3>
        <p className="text-xs text-ink-muted mb-3">{course.instructor.name}</p>
        <Rating value={course.rating} count={course.students} size={13} />
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-line text-[0.75rem] text-ink-muted">
          <span className="flex items-center gap-1.5"><Clock size={13} /> {course.duration}</span>
          <span className="flex items-center gap-1.5"><ChartBar size={13} /> {course.level}</span>
          <span className="flex items-center gap-1.5"><Users size={13} /> {course.students.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <strong className="text-sm font-bold text-ink-strong">Nu. {course.discountPrice.toLocaleString()}</strong>
          {course.discountPrice < course.price && (
            <span className="text-xs text-ink-muted line-through">Nu. {course.price.toLocaleString()}</span>
          )}
        </div>
      </div>
    </Link>
  );
}