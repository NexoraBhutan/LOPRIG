"use client";

import { useEffect, useState } from "react";
import type { Course } from "@/types";
import { ApiError, api } from "@/lib/api";
import { type ApiCourse, toCourse } from "@/lib/mappers";

interface CourseDetailState {
  course: Course | null;
  loading: boolean;
  /** Set for anything other than "not found", e.g. the server being unreachable. */
  error: string | null;
}

interface Result {
  id: string;
  course: Course | null;
  error: string | null;
}

/** One published course with its curriculum, requirements and outcomes. */
export function useCourseDetail(id: string): CourseDetailState {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api<ApiCourse>(`/courses/${encodeURIComponent(id)}/`)
      .then((c) => !cancelled && setResult({ id, course: toCourse(c), error: null }))
      .catch((err) => {
        if (cancelled) return;
        const notFound = err instanceof ApiError && err.status === 404;
        setResult({ id, course: null, error: notFound ? null : err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // A result for a different id (the user navigated) counts as still loading.
  if (!result || result.id !== id) return { course: null, loading: Boolean(id), error: null };
  return { course: result.course, loading: false, error: result.error };
}
