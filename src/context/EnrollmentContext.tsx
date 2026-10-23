"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ActionResult, Course, EnrollmentMap } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { api, apiAll, errorMessage } from "@/lib/api";
import { type ApiCourse, toCourse } from "@/lib/mappers";

interface EnrollmentContextValue {
  enrollments: EnrollmentMap;
  enrolledCourses: Course[];
  savedCourses: Course[];
  /** False until the signed-in student's enrollments have loaded. */
  ready: boolean;
  isEnrolled: (courseId: string) => boolean;
  toggleSaved: (courseId: string) => Promise<void>;
  enrollFree: (courseId: string) => Promise<ActionResult>;
  getProgress: (courseId: string) => number;
  /** Re-fetch after something changed server-side (payment, lesson completed, ...). */
  refresh: () => Promise<void>;
  streak: number;
  xp: number;
}

interface ApiEnrollment {
  course: ApiCourse;
  status: "ACTIVE" | "COMPLETED";
  progress: number;
  last_lesson: number | null;
  activated_at: string | null;
}

interface ApiSaved {
  course: ApiCourse;
}

interface ApiSummary {
  streak: number;
  xp: number;
}

interface State {
  enrollments: EnrollmentMap;
  enrolledCourses: Course[];
  savedCourses: Course[];
  streak: number;
  xp: number;
}

const EMPTY: State = { enrollments: {}, enrolledCourses: [], savedCourses: [], streak: 0, xp: 0 };

const EnrollmentContext = createContext<EnrollmentContextValue | null>(null);

async function loadState(): Promise<State> {
  const [enrolled, saved, summary] = await Promise.all([
    apiAll<ApiEnrollment>("/enrollments/"),
    apiAll<ApiSaved>("/saved-courses/"),
    api<ApiSummary>("/learning/summary/"),
  ]);
  const savedIds = new Set(saved.map((s) => s.course.id));
  const enrollments: EnrollmentMap = {};
  for (const e of enrolled) {
    enrollments[e.course.id] = {
      courseId: e.course.id,
      status: e.status,
      enrolledAt: e.activated_at,
      lastLesson: e.last_lesson === null ? null : String(e.last_lesson),
      progress: e.progress,
      saved: savedIds.has(e.course.id),
    };
  }
  for (const s of saved) {
    enrollments[s.course.id] ??= {
      courseId: s.course.id,
      status: null,
      enrolledAt: null,
      lastLesson: null,
      progress: 0,
      saved: true,
    };
  }
  return {
    enrollments,
    enrolledCourses: enrolled.map((e) => toCourse(e.course)),
    savedCourses: saved.map((s) => toCourse(s.course)),
    streak: summary.streak,
    xp: summary.xp,
  };
}

export function EnrollmentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Enrollments, saved courses and streaks only exist for students.
  const userId = user?.role === "STUDENT" ? user.id : undefined;
  const [state, setState] = useState<State>(EMPTY);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setState(await loadState());
    } catch {
      // Keep what we have; pages surface their own errors for the actions they take.
    }
    setLoadedFor(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setState(EMPTY);
      setLoadedFor(null);
      return;
    }
    let cancelled = false;
    loadState()
      .then((next) => !cancelled && setState(next))
      .catch(() => undefined)
      .finally(() => !cancelled && setLoadedFor(userId));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const isEnrolled = useCallback(
    (courseId: string) => Boolean(state.enrollments[courseId]?.enrolledAt),
    [state.enrollments]
  );

  const getProgress = useCallback(
    (courseId: string) => state.enrollments[courseId]?.progress ?? 0,
    [state.enrollments]
  );

  const toggleSaved = useCallback(
    async (courseId: string) => {
      const wasSaved = Boolean(state.enrollments[courseId]?.saved);
      if (wasSaved) await api(`/saved-courses/${courseId}/`, { method: "DELETE" });
      else await api("/saved-courses/", { method: "POST", body: { course: courseId } });
      await refresh();
    },
    [state.enrollments, refresh]
  );

  const enrollFree = useCallback(
    async (courseId: string): Promise<ActionResult> => {
      try {
        await api(`/courses/${courseId}/enroll/`, { method: "POST" });
        await refresh();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorMessage(err) };
      }
    },
    [refresh]
  );

  const value = useMemo<EnrollmentContextValue>(
    () => ({
      ...state,
      ready: !userId || loadedFor === userId,
      isEnrolled,
      toggleSaved,
      enrollFree,
      getProgress,
      refresh,
    }),
    [state, userId, loadedFor, isEnrolled, toggleSaved, enrollFree, getProgress, refresh]
  );

  return <EnrollmentContext.Provider value={value}>{children}</EnrollmentContext.Provider>;
}

export function useEnrollment(): EnrollmentContextValue {
  const ctx = useContext(EnrollmentContext);
  if (!ctx) throw new Error("useEnrollment must be used within EnrollmentProvider");
  return ctx;
}
