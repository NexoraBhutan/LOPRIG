import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { getCourseById } from "../data/courses";

const EnrollmentContext = createContext(null);

function storageKey(userId) {
  return `loprig_enrollments_${userId || "guest"}`;
}

function streakKey(userId) {
  return `loprig_streak_${userId || "guest"}`;
}

function readEnrollments(userId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId))) || {};
  } catch {
    return {};
  }
}

function readStreak(userId) {
  try {
    return JSON.parse(localStorage.getItem(streakKey(userId))) || { count: 0, lastActive: null };
  } catch {
    return { count: 0, lastActive: null };
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Duolingo's signature mechanic: a day-streak that grows on consecutive days
// of activity and resets if a day is skipped. Plain date math against the
// last-active day, no backend needed — same "derive it from local state"
// approach as enrollments/progress.
function bumpStreak(prev) {
  const today = todayISO();
  if (prev.lastActive === today) return prev;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const count = prev.lastActive === yesterday ? prev.count + 1 : 1;
  return { count, lastActive: today };
}

export function EnrollmentProvider({ children }) {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState({});
  const [streak, setStreak] = useState({ count: 0, lastActive: null });

  useEffect(() => {
    setEnrollments(readEnrollments(user?.id));
    setStreak(readStreak(user?.id));
  }, [user?.id]);

  const persist = useCallback(
    (next) => {
      setEnrollments(next);
      localStorage.setItem(storageKey(user?.id), JSON.stringify(next));
    },
    [user?.id]
  );

  const recordActivity = useCallback(() => {
    setStreak((prev) => {
      const next = bumpStreak(prev);
      if (next === prev) return prev;
      localStorage.setItem(streakKey(user?.id), JSON.stringify(next));
      return next;
    });
  }, [user?.id]);

  const isEnrolled = useCallback((courseId) => Boolean(enrollments[courseId]), [enrollments]);

  const enroll = useCallback(
    (courseId) => {
      if (enrollments[courseId]) return;
      const next = {
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
    (courseId) => {
      const existing = enrollments[courseId] || {
        courseId,
        enrolledAt: null,
        completedLessons: [],
        lastLesson: null,
      };
      const next = { ...enrollments, [courseId]: { ...existing, saved: !existing.saved } };
      persist(next);
    },
    [enrollments, persist]
  );

  const markLessonComplete = useCallback(
    (courseId, lessonId) => {
      const existing = enrollments[courseId];
      if (!existing) return;
      const completed = existing.completedLessons.includes(lessonId)
        ? existing.completedLessons
        : [...existing.completedLessons, lessonId];
      const next = {
        ...enrollments,
        [courseId]: { ...existing, completedLessons: completed, lastLesson: lessonId },
      };
      persist(next);
      recordActivity();
    },
    [enrollments, persist, recordActivity]
  );

  const setLastLesson = useCallback(
    (courseId, lessonId) => {
      const existing = enrollments[courseId];
      if (!existing) return;
      persist({ ...enrollments, [courseId]: { ...existing, lastLesson: lessonId } });
    },
    [enrollments, persist]
  );

  const getProgress = useCallback(
    (courseId) => {
      const course = getCourseById(courseId);
      const record = enrollments[courseId];
      if (!course || !record) return 0;
      const total = course.curriculum.reduce((sum, s) => sum + s.lessons.length, 0);
      if (!total) return 0;
      return Math.round((record.completedLessons.length / total) * 100);
    },
    [enrollments]
  );

  const enrolledCourses = Object.keys(enrollments)
    .filter((id) => enrollments[id].enrolledAt)
    .map((id) => getCourseById(id))
    .filter(Boolean);

  const savedCourses = Object.keys(enrollments)
    .filter((id) => enrollments[id].saved)
    .map((id) => getCourseById(id))
    .filter(Boolean);

  // XP is derived, not stored: 10 per completed lesson + a 100 bonus per
  // fully-finished course, same "compute from what's already there" approach
  // as getProgress — no separate ledger to keep in sync.
  const totalCompletedLessons = Object.values(enrollments).reduce(
    (sum, rec) => sum + (rec.completedLessons?.length || 0),
    0
  );
  const completedCourseCount = enrolledCourses.filter((c) => getProgress(c.id) === 100).length;
  const xp = totalCompletedLessons * 10 + completedCourseCount * 100;

  return (
    <EnrollmentContext.Provider
      value={{
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
      }}
    >
      {children}
    </EnrollmentContext.Provider>
  );
}

export function useEnrollment() {
  const ctx = useContext(EnrollmentContext);
  if (!ctx) throw new Error("useEnrollment must be used within EnrollmentProvider");
  return ctx;
}
