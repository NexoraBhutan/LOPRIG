"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Course, CourseProgress, EnrollmentMap, Streak } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getCourseById } from "@/data/courses";
import { safeParseJSON, safeSetItem } from "@/utils/storage";

interface EnrollmentContextValue {
  enrollments: EnrollmentMap;
  enrolledCourses: Course[];
  savedCourses: Course[];
  isEnrolled: (courseId: string) => boolean;
  enroll: (courseId: string) => void;
  toggleSaved: (courseId: string) => void;
  markLessonComplete: (courseId: string, lessonId: string) => void;
  setLastLesson: (courseId: string, lessonId: string) => void;
  getProgress: (courseId: string) => number;
  streak: number;
  xp: number;
}

const EnrollmentContext = createContext<EnrollmentContextValue | null>(null);

function storageKey(userId: string | undefined): string {
  return `loprig_enrollments_${userId || "guest"}`;
}

function streakKey(userId: string | undefined): string {
  return `loprig_streak_${userId || "guest"}`;
}

function readEnrollments(userId: string | undefined): EnrollmentMap {
  return safeParseJSON<EnrollmentMap>(storageKey(userId), {});
}

function readStreak(userId: string | undefined): Streak {
  return safeParseJSON<Streak>(streakKey(userId), { count: 0, lastActive: null });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Duolingo's signature mechanic: a day-streak that grows on consecutive days
// of activity and resets if a day is skipped. Plain date math against the
// last-active day, no backend needed — same "derive it from local state"
// approach as enrollments/progress.
function bumpStreak(prev: Streak): Streak {
  const today = todayISO();
  if (prev.lastActive === today) return prev;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const count = prev.lastActive === yesterday ? prev.count + 1 : 1;
  return { count, lastActive: today };
}

export function EnrollmentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [enrollments, setEnrollments] = useState<EnrollmentMap>({});
  const [streak, setStreak] = useState<Streak>({ count: 0, lastActive: null });

  useEffect(() => {
    setEnrollments(readEnrollments(userId));
    setStreak(readStreak(userId));
  }, [userId]);

  const persist = useCallback(
    (next: EnrollmentMap) => {
      setEnrollments(next);
      safeSetItem(storageKey(userId), JSON.stringify(next));
    },
    [userId]
  );

  const recordActivity = useCallback(() => {
    setStreak((prev) => {
      const next = bumpStreak(prev);
      if (next === prev) return prev;
      safeSetItem(streakKey(userId), JSON.stringify(next));
      return next;
    });
  }, [userId]);

  const isEnrolled = useCallback(
    (courseId: string) => Boolean(enrollments[courseId]),
    [enrollments]
  );

  const enroll = useCallback(
    (courseId: string) => {
      if (enrollments[courseId]) return;
      const next: EnrollmentMap = {
        ...enrollments,
        [courseId]: {
          courseId,
          enrolledAt: new Date().toISOString(),
          completedLessons: [],
          lastLesson: null,
          saved: false,
        },
      };
      persist(next);
      recordActivity();
    },
    [enrollments, persist, recordActivity]
  );

  const toggleSaved = useCallback(
    (courseId: string) => {
      const existing = enrollments[courseId] ?? {
        courseId,
        enrolledAt: null,
        completedLessons: [],
        lastLesson: null,
      };
      const next: EnrollmentMap = {
        ...enrollments,
        [courseId]: { ...existing, saved: !existing.saved },
      };
      persist(next);
    },
    [enrollments, persist]
  );

  const markLessonComplete = useCallback(
    (courseId: string, lessonId: string) => {
      const existing = enrollments[courseId];
      if (!existing) return;
      const completed = existing.completedLessons.includes(lessonId)
        ? existing.completedLessons
        : [...existing.completedLessons, lessonId];
      const next: EnrollmentMap = {
        ...enrollments,
        [courseId]: { ...existing, completedLessons: completed, lastLesson: lessonId },
      };
      persist(next);
      recordActivity();
    },
    [enrollments, persist, recordActivity]
  );

  const setLastLesson = useCallback(
    (courseId: string, lessonId: string) => {
      const existing = enrollments[courseId];
      if (!existing) return;
      persist({ ...enrollments, [courseId]: { ...existing, lastLesson: lessonId } });
    },
    [enrollments, persist]
  );

  const getProgress = useCallback(
    (courseId: string) => {
      const course = getCourseById(courseId);
      const record = enrollments[courseId];
      if (!course || !record) return 0;
      const total = course.curriculum.reduce((sum, s) => sum + s.lessons.length, 0);
      if (!total) return 0;
      return Math.round((record.completedLessons.length / total) * 100);
    },
    [enrollments]
  );

  const enrolledCourses = useMemo(
    () =>
      Object.keys(enrollments)
        .filter((id) => enrollments[id]?.enrolledAt)
        .map((id) => getCourseById(id))
        .filter((c): c is Course => Boolean(c)),
    [enrollments]
  );

  const savedCourses = useMemo(
    () =>
      Object.keys(enrollments)
        .filter((id) => enrollments[id]?.saved)
        .map((id) => getCourseById(id))
        .filter((c): c is Course => Boolean(c)),
    [enrollments]
  );

  // XP is derived, not stored: 10 per completed lesson + a 100 bonus per
  // fully-finished course, same "compute from what's already there" approach
  // as getProgress — no separate ledger to keep in sync.
  const totalCompletedLessons = Object.values(enrollments).reduce(
    (sum, rec) => sum + (rec.completedLessons?.length || 0),
    0
  );
  const completedCourseCount = enrolledCourses.filter((c) => getProgress(c.id) === 100).length;
  const xp = totalCompletedLessons * 10 + completedCourseCount * 100;

  const value = useMemo<EnrollmentContextValue>(
    () => ({
      enrollments,
      enrolledCourses,
      savedCourses,
      isEnrolled,
      enroll,
      toggleSaved,
      markLessonComplete,
      setLastLesson,
      getProgress,
      streak: streak.count,
      xp,
    }),
    [
      enrollments,
      enrolledCourses,
      savedCourses,
      isEnrolled,
      enroll,
      toggleSaved,
      markLessonComplete,
      setLastLesson,
      getProgress,
      streak.count,
      xp,
    ]
  );

  return <EnrollmentContext.Provider value={value}>{children}</EnrollmentContext.Provider>;
}

export function useEnrollment(): EnrollmentContextValue {
  const ctx = useContext(EnrollmentContext);
  if (!ctx) throw new Error("useEnrollment must be used within EnrollmentProvider");
  return ctx;
}

export type { CourseProgress };