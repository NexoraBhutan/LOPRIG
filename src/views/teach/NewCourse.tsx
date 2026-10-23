"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import { useToast } from "@/context/ToastContext";
import CourseForm from "@/components/teach/CourseForm";

export default function NewCourse() {
  const router = useRouter();
  const { push } = useToast();
  return (
    <div className="flex flex-col gap-7">
      <div>
        <Link href="/teach/courses" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink-muted hover:text-ink-strong no-underline mb-5">
          <ArrowLeft size={14} weight="bold" /> My courses
        </Link>
        <h1 className="font-display text-3xl md:text-4xl tracking-tighter font-semibold text-ink-strong">Create a course</h1>
        <p className="text-sm text-ink-muted mt-2">Start with the basics. You&apos;ll add modules and lessons on the next screen.</p>
      </div>
      <CourseForm
        onSaved={(course) => {
          push("Course created. Now add your lessons.", "success");
          router.push(`/teach/courses/${course.id}?tab=curriculum`);
        }}
      />
    </div>
  );
}
