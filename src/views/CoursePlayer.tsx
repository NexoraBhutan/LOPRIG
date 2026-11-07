"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, CaretLeft, CaretRight, DownloadSimple, ArrowLeft, X, Play, Certificate, Exam, Hourglass } from "@phosphor-icons/react";
import QuizPanel, { type QuizResult } from "@/components/QuizPanel";
import { useEnrollment } from "@/context/EnrollmentContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import EmptyState from "@/components/EmptyState";
import PageLoader from "@/components/PageLoader";
import UserAvatar from "@/components/UserAvatar";
import LessonComments from "@/components/LessonComments";
import { CoverArt } from "@/components/CourseThumb";
import { ApiError, api, errorMessage } from "@/lib/api";
import type { ApiCourse, ApiModule } from "@/lib/mappers";
import VideoFrame from "@/components/VideoFrame";
import type { Playback } from "@/lib/video";

/** Lessons without a known length come back as "0:00"; don't show that. */
const hasDuration = (d: string) => Boolean(d) && !/^0+(:0+)*$/.test(d);

const compact = new Intl.NumberFormat("en", { notation: "compact" });
const viewsLabel = (n: number) => `${compact.format(n)} ${n === 1 ? "view" : "views"}`;

interface PlayerLesson {
  id: number;
  title: string;
  kind: "VIDEO" | "TEXT" | "H5P";
  duration: string;
  video: Playback;
  body: string;
  h5p_embed_url: string;
  resources: { id: number; title: string; url: string }[];
  completed: boolean;
  position_seconds: number;
  views: number;
}

interface Progress {
  completed_lessons: number;
  total_lessons: number;
  passed_quizzes?: number;
  total_quizzes?: number;
  percent: number;
}

interface ModuleQuiz {
  id: number;
  title: string;
  pass_percent: number;
  questions_count: number;
  best_score: number | null;
  passed: boolean;
  /** Written answers waiting for the teacher to mark. */
  pending: boolean;
}

type PlayerModule = ApiModule<PlayerLesson> & { quiz: ModuleQuiz | null };

interface LearnCourse {
  /** "OPEN": a free course watched without an enrollment (visitor), so nothing is saved. */
  status: string;
  course: ApiCourse;
  progress: Progress;
  last_lesson: number | null;
  certificate: string | null;
  modules: PlayerModule[];
}

interface ProgressResponse {
  lesson: number;
  completed: boolean;
  course_progress: Progress;
  course_completed: boolean;
  certificate: string | null;
}

type LoadState = "loading" | "ready" | "not-enrolled" | "not-found" | "error";

export default function CoursePlayer() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();
  const { refresh } = useEnrollment();
  const { push } = useToast();
  const { user, ready } = useAuth();
  const userId = user?.id;

  const [data, setData] = useState<LearnCourse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [activeLessonId, setActiveLessonId] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  // A chapter quiz shown in place of the video; null = a lesson is showing.
  const [activeQuizId, setActiveQuizId] = useState<number | null>(null);
  const openedLesson = useRef<number | undefined>(undefined);
  const viewed = useRef<Set<number>>(new Set());

  // Free courses are open to visitors; wait for the session check so students load with progress.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    api<LearnCourse>(`/learning/courses/${encodeURIComponent(id)}/`)
      .then((res) => {
        if (cancelled) return;
        const first = res.modules.flatMap((m) => m.lessons)[0]?.id;
        setData(res);
        setActiveLessonId(res.last_lesson ?? first);
        openedLesson.current = res.last_lesson ?? first;
        // Links from "your answers were reviewed" emails open that chapter quiz.
        const quizParam = Number(new URLSearchParams(window.location.search).get("quiz"));
        if (quizParam && res.modules.some((m) => m.quiz?.id === quizParam)) setActiveQuizId(quizParam);
        setLoadState("ready");
        if (res.status !== "OPEN") refresh(); // a free course may have just been added to My Learning
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace(`/login?from=${encodeURIComponent(`/learn/${id}`)}`);
          return;
        }
        if (err instanceof ApiError && err.status === 403) setLoadState("not-enrolled");
        else if (err instanceof ApiError && err.status === 404) setLoadState("not-found");
        else setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, ready, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remember the lesson the student opens, so "Continue learning" resumes there.
  const tracking = data?.status !== undefined && data.status !== "OPEN";
  useEffect(() => {
    if (!tracking || activeLessonId === undefined || activeLessonId === openedLesson.current) return;
    openedLesson.current = activeLessonId;
    api(`/learning/lessons/${activeLessonId}/progress/`, { method: "POST", body: {} }).catch(() => undefined);
  }, [activeLessonId, tracking]);

  // Count the view (each student once per lesson) and show the fresh number.
  useEffect(() => {
    if (!user || activeLessonId === undefined || viewed.current.has(activeLessonId)) return;
    viewed.current.add(activeLessonId);
    const lessonId = activeLessonId;
    api<{ views: number }>(`/learning/lessons/${lessonId}/view/`, { method: "POST" })
      .then(({ views }) =>
        setData((prev) => prev && {
          ...prev,
          modules: prev.modules.map((m) => ({
            ...m,
            lessons: m.lessons.map((l) => (l.id === lessonId ? { ...l, views } : l)),
          })),
        })
      )
      .catch(() => undefined);
  }, [activeLessonId, user]);

  const allLessons = useMemo(
    () => data?.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, sectionTitle: m.title }))) ?? [],
    [data]
  );

  const selectLesson = useCallback((lessonId: number) => {
    setActiveLessonId(lessonId);
    setActiveQuizId(null);
    setNotesOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const selectQuiz = useCallback((quizId: number) => {
    setActiveQuizId(quizId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (loadState === "loading") return <PageLoader />;

  if (loadState === "not-enrolled") {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center px-8">
        <EmptyState
          pose="sad"
          title="You are not enrolled in this course"
          description="Enroll first to unlock the lessons and track your progress."
          ctaLabel="Enroll now"
          ctaTo={`/courses/${id}`}
        />
      </div>
    );
  }

  if (loadState !== "ready" || !data) {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center px-8">
        <EmptyState
          pose="sad"
          title={loadState === "not-found" ? "Course not found" : "Couldn't load this course"}
          description={loadState === "error" ? "Check your connection and try again." : undefined}
          ctaLabel="Browse courses"
          ctaTo="/courses"
        />
      </div>
    );
  }

  const course = data.course;
  const progress = data.progress.percent;
  const activeIndex = allLessons.findIndex((l) => l.id === activeLessonId);
  const activeLesson = allLessons[activeIndex];
  const isCompleted = Boolean(activeLesson?.completed);
  const loginHref = `/login?from=${encodeURIComponent(`/learn/${id}`)}`;

  const goTo = (idx: number) => {
    const target = allLessons[idx];
    if (target) selectLesson(target.id);
  };

  // The chapter the current lesson belongs to, and its quiz.
  const chapter = data.modules.find((m) => m.lessons.some((l) => l.id === activeLesson?.id));
  const chapterQuiz = chapter?.quiz ?? null;
  const isLastInChapter = Boolean(chapter && chapter.lessons[chapter.lessons.length - 1]?.id === activeLesson?.id);

  // While a quiz is open: its chapter, and where "Continue" goes (the next chapter's first lesson).
  const quizModule = activeQuizId === null ? null : data.modules.find((m) => m.quiz?.id === activeQuizId) ?? null;
  const nextChapterLesson = (() => {
    if (!quizModule) return undefined;
    const last = quizModule.lessons[quizModule.lessons.length - 1];
    const idx = allLessons.findIndex((l) => l.id === last?.id);
    return idx >= 0 ? allLessons[idx + 1] : undefined;
  })();

  const onQuizResult = (quizId: number, res: QuizResult) => {
    setData((prev) => prev && {
      ...prev,
      progress: res.course_progress,
      certificate: res.certificate ?? prev.certificate,
      modules: prev.modules.map((m) =>
        m.quiz?.id === quizId
          ? {
              ...m,
              quiz: {
                ...m.quiz,
                best_score: res.score === null ? m.quiz.best_score : Math.max(m.quiz.best_score ?? 0, res.score),
                passed: m.quiz.passed || res.passed,
                pending: res.status === "PENDING",
              },
            }
          : m
      ),
    });
    refresh();
  };

  const handleComplete = async () => {
    if (!activeLesson || saving) return;
    if (!tracking) {
      if (user) push("Progress is saved for student accounts only.", "info");
      else {
        push("Log in to save your progress and earn the certificate. It's free.", "info");
        router.push(loginHref);
      }
      return;
    }
    if (activeLesson.completed) {
      push("Already completed", "info");
      return;
    }
    setSaving(true);
    try {
      const res = await api<ProgressResponse>(`/learning/lessons/${activeLesson.id}/progress/`, {
        method: "POST",
        body: { completed: true },
      });
      setData((prev) => prev && {
        ...prev,
        progress: res.course_progress,
        certificate: res.certificate ?? prev.certificate,
        modules: prev.modules.map((m) => ({
          ...m,
          lessons: m.lessons.map((l) => (l.id === res.lesson ? { ...l, completed: true } : l)),
        })),
      });
      refresh();
      if (res.course_completed && res.certificate) {
        push("Course complete! Your certificate is ready.", "success");
        setTimeout(() => router.push(`/certificates/${res.certificate}`), 1200);
        return;
      }
      // Finished the chapter's last lesson: its quiz comes next.
      if (chapterQuiz && !chapterQuiz.passed && !chapterQuiz.pending && isLastInChapter) {
        push("Chapter finished! Time for a quick quiz.", "success");
        setTimeout(() => selectQuiz(chapterQuiz.id), 700);
        return;
      }
      push("Lesson marked complete!", "success");
      if (activeIndex < allLessons.length - 1) {
        const next = allLessons[activeIndex + 1];
        setTimeout(() => selectLesson(next.id), 700);
      }
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const resources = activeLesson?.resources ?? [];
  const notes = activeLesson?.body?.trim() ?? "";
  const longNotes = notes.length > 280 || notes.split("\n").length > 4;
  const instructor = course.instructor;

  return (
    <main className="w-full min-h-[100dvh] bg-bg-soft">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex items-center gap-3 sm:gap-4 h-14 px-4 sm:px-6 bg-ink-strong text-white">
        <Link href={user ? "/my-learning" : "/courses"} className="flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors no-underline">
          <ArrowLeft size={16} weight="bold" />
          <span className="hidden sm:inline">{user ? "My Learning" : "Courses"}</span>
        </Link>
        <span className="h-5 w-px bg-white/15" aria-hidden="true" />
        <p className="flex-1 min-w-0 text-sm font-semibold truncate">{course.title}</p>
        {tracking && (
          <span className="hidden sm:inline text-xs text-white/60 tabular-nums">
            {data.progress.completed_lessons}/{data.progress.total_lessons} done · {progress}%
          </span>
        )}
        <button
          onClick={() => router.push(`/courses/${course.id}`)}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border-none"
          aria-label="Close player"
        >
          <X size={14} weight="bold" />
        </button>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 grid gap-x-6 gap-y-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        {/* Video + details */}
        <section className="min-w-0 lg:col-start-1">
          {quizModule?.quiz ? (
            <QuizPanel
              quizId={quizModule.quiz.id}
              canAttempt={tracking}
              loginHref={loginHref}
              onResult={onQuizResult}
              onContinue={nextChapterLesson ? () => selectLesson(nextChapterLesson.id) : undefined}
              continueLabel={nextChapterLesson ? `Next: ${nextChapterLesson.title}` : undefined}
            />
          ) : (
          <>
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-ink-strong shadow-soft">
            {activeLesson?.video.url ? (
              <VideoFrame
                key={activeLesson.id}
                playback={activeLesson.video}
                title={activeLesson.title}
                className="absolute inset-0 w-full h-full object-contain"
                videoProps={{
                  onLoadedMetadata: (e) => {
                    if (activeLesson.position_seconds) e.currentTarget.currentTime = activeLesson.position_seconds;
                  },
                }}
              />
            ) : (
              activeLesson && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 aw-dark-wash">
                  <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-4">Reading lesson</p>
                  <h2 className="font-display text-2xl md:text-3xl text-white max-w-[640px] leading-tight">{activeLesson.title}</h2>
                  <p className="text-white/50 text-sm mt-4">The notes for this lesson are below.</p>
                </div>
              )
            )}
          </div>

          {activeLesson && (
            <>
              <h1 className="mt-4 text-xl md:text-2xl font-semibold text-ink-strong leading-snug">{activeLesson.title}</h1>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar name={instructor.name} src={instructor.avatar} color="#ffb606" textColor="text-ink-strong" className="w-10 h-10 text-sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-strong truncate">{instructor.name}</p>
                    <p className="text-xs text-ink-muted truncate">{instructor.title || "Instructor"}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-full bg-white border-2 border-line overflow-hidden">
                    <button
                      onClick={() => goTo(activeIndex - 1)}
                      disabled={activeIndex <= 0}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-ink-strong bg-transparent border-none cursor-pointer hover:bg-bg-soft disabled:opacity-35 disabled:cursor-not-allowed"
                      aria-label="Previous lesson"
                    >
                      <CaretLeft size={13} weight="bold" /> <span className="hidden sm:inline">Previous</span>
                    </button>
                    <span className="w-px bg-line" aria-hidden="true" />
                    <button
                      onClick={() => goTo(activeIndex + 1)}
                      disabled={activeIndex >= allLessons.length - 1}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-ink-strong bg-transparent border-none cursor-pointer hover:bg-bg-soft disabled:opacity-35 disabled:cursor-not-allowed"
                      aria-label="Next lesson"
                    >
                      <span className="hidden sm:inline">Next</span> <CaretRight size={13} weight="bold" />
                    </button>
                  </div>
                  <button
                    onClick={handleComplete}
                    disabled={saving}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer border-2 disabled:cursor-wait ${
                      isCompleted
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-gold text-ink-strong border-gold hover:bg-gold-dark hover:border-gold-dark"
                    }`}
                  >
                    <CheckCircle size={15} weight={isCompleted ? "fill" : "bold"} />
                    {isCompleted ? "Completed" : saving ? "Saving…" : "Mark as complete"}
                  </button>
                </div>
              </div>

              {/* Details */}
              <div className="mt-4 rounded-2xl bg-white border-2 border-line p-4 sm:p-5">
                <p className="text-sm font-semibold text-ink-strong">
                  {viewsLabel(activeLesson.views ?? 0)}
                  <span className="text-ink-muted font-normal">
                    {" · "}Lesson {activeIndex + 1} of {allLessons.length}
                    {activeLesson.sectionTitle && ` · ${activeLesson.sectionTitle}`}
                    {hasDuration(activeLesson.duration) && ` · ${activeLesson.duration}`}
                  </span>
                </p>
                {notes ? (
                  <div className="mt-2">
                    <p className={`text-sm text-ink leading-relaxed whitespace-pre-line ${longNotes && !notesOpen ? "line-clamp-3" : ""}`}>{notes}</p>
                    {longNotes && (
                      <button onClick={() => setNotesOpen((o) => !o)} className="mt-1 text-sm font-bold text-ink-strong bg-transparent border-none p-0 cursor-pointer hover:text-gold-dark">
                        {notesOpen ? "Show less" : "…more"}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-ink-muted">No notes for this lesson.</p>
                )}
                {resources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-line flex flex-wrap gap-2">
                    {resources.map((r) => (
                      <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-bg-soft border-2 border-line px-3 py-1.5 text-xs font-bold text-ink-strong hover:border-gold no-underline transition-colors">
                        <DownloadSimple size={13} weight="bold" /> {r.title}
                      </a>
                    ))}
                  </div>
                )}
                {data.certificate && (
                  <div className="mt-4 pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                      <Certificate size={18} weight="fill" /> You&apos;ve completed this course. Your certificate is ready!
                    </p>
                    <Link href={`/certificates/${data.certificate}`} className="btn btn-sm btn-primary no-underline">
                      View certificate
                    </Link>
                  </div>
                )}
              </div>

              {isLastInChapter && chapterQuiz && (
                <div className="mt-4 rounded-2xl border-2 border-gold bg-gold-soft/60 p-4 sm:p-5 flex flex-wrap items-center gap-4">
                  <span className="w-11 h-11 rounded-xl bg-gold text-ink-strong flex items-center justify-center flex-shrink-0">
                    <Exam size={22} weight="duotone" />
                  </span>
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm font-bold text-ink-strong">
                      {chapterQuiz.passed ? "Chapter quiz passed" : chapterQuiz.pending ? "Chapter quiz in review" : "Ready for the chapter quiz?"}
                    </p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {chapterQuiz.passed
                        ? `Best score ${chapterQuiz.best_score}%. You can retake it any time.`
                        : chapterQuiz.pending
                          ? "Your teacher is marking your written answers. You'll be notified when it's done."
                          : `${chapterQuiz.questions_count} questions on “${chapter?.title}”. Score ${chapterQuiz.pass_percent}% to pass.`}
                    </p>
                  </div>
                  <button onClick={() => selectQuiz(chapterQuiz.id)} className="btn btn-sm btn-primary">
                    {chapterQuiz.passed ? "Retake quiz" : chapterQuiz.pending ? "See your answers" : "Take the quiz"}
                  </button>
                </div>
              )}
            </>
          )}
          </>
          )}
        </section>

        {/* Lesson list */}
        <aside
          aria-label="Course content"
          className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] flex flex-col rounded-2xl bg-white border-2 border-line overflow-hidden"
        >
          <div className="p-4 border-b border-line">
            <h2 className="text-sm font-bold text-ink-strong">Course content</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              {allLessons.length} lessons
              {(data.progress.total_quizzes ?? 0) > 0 && ` · ${data.progress.total_quizzes} quizzes`}
              {tracking && ` · ${progress}% complete`}
            </p>
            {tracking && (
              <div className="h-1.5 bg-bg-sunken rounded-full overflow-hidden mt-3">
                <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
          <nav className="overflow-y-auto p-2" aria-label="Lessons">
            {data.modules.map((section) => (
              <div key={section.id} className="mb-2">
                {data.modules.length > 1 && (
                  <p className="px-2 pt-3 pb-2 text-[0.7rem] font-bold text-ink-muted uppercase tracking-wider">{section.title}</p>
                )}
                <ul className="flex flex-col gap-1">
                  {section.lessons.map((l) => {
                    const active = l.id === activeLessonId && activeQuizId === null;
                    const number = allLessons.findIndex((x) => x.id === l.id) + 1;
                    return (
                      <li key={l.id}>
                        <button
                          onClick={() => selectLesson(l.id)}
                          aria-current={active ? "true" : undefined}
                          className={`w-full flex gap-3 p-2 rounded-xl text-left border-none cursor-pointer transition-colors ${active ? "bg-gold-soft" : "bg-transparent hover:bg-bg-soft"}`}
                        >
                          <CoverArt
                            src={course.thumbnail_url}
                            gradient={course.gradient}
                            iconSize={0}
                            className="w-36 sm:w-40 aspect-video rounded-lg flex-shrink-0"
                          >
                            <span className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[0.65rem] font-bold text-white tabular-nums">{number}</span>
                            {active ? (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white text-[0.65rem] font-bold uppercase tracking-wider gap-1">
                                <Play size={12} weight="fill" /> Now playing
                              </span>
                            ) : l.completed ? (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                                <CheckCircle size={26} weight="fill" className="text-emerald-400" />
                              </span>
                            ) : null}
                            {hasDuration(l.duration) && (
                              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[0.65rem] font-bold text-white tabular-nums">{l.duration}</span>
                            )}
                          </CoverArt>
                          <span className="flex-1 min-w-0 py-0.5">
                            <span className={`block text-sm leading-snug line-clamp-2 ${active ? "font-bold text-ink-strong" : "font-semibold text-ink"}`}>{l.title}</span>
                            <span className="block text-xs text-ink-muted mt-1">{viewsLabel(l.views ?? 0)}</span>
                            {l.completed && <span className="block text-xs font-bold text-emerald-600 mt-0.5">Completed</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {section.quiz && (
                    <li>
                      <button
                        onClick={() => selectQuiz(section.quiz!.id)}
                        aria-current={activeQuizId === section.quiz.id ? "true" : undefined}
                        className={`w-full flex items-center gap-3 p-2 rounded-xl text-left border-none cursor-pointer transition-colors ${activeQuizId === section.quiz.id ? "bg-gold-soft" : "bg-transparent hover:bg-bg-soft"}`}
                      >
                        <span className={`w-36 sm:w-40 aspect-[16/7] rounded-lg flex-shrink-0 flex flex-col items-center justify-center gap-1 ${section.quiz.passed ? "bg-emerald-500 text-white" : section.quiz.pending ? "bg-gold text-ink-strong" : "bg-ink-strong text-gold"}`}>
                          {section.quiz.passed ? <CheckCircle size={22} weight="fill" /> : section.quiz.pending ? <Hourglass size={22} weight="duotone" /> : <Exam size={22} weight="duotone" />}
                          <span className="text-[0.6rem] font-bold uppercase tracking-widest">{section.quiz.passed ? "Passed" : section.quiz.pending ? "In review" : "Chapter quiz"}</span>
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-ink leading-snug line-clamp-2">{section.quiz.title}</span>
                          <span className="block text-xs text-ink-muted mt-1">
                            {section.quiz.questions_count} questions · pass {section.quiz.pass_percent}%
                          </span>
                          {section.quiz.best_score !== null && (
                            <span className={`block text-xs font-bold mt-0.5 ${section.quiz.passed ? "text-emerald-600" : "text-gold-dark"}`}>
                              Best score {section.quiz.best_score}%
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Comments */}
        {activeLesson && activeQuizId === null && (
          <div className="min-w-0 lg:col-start-1">
            <LessonComments lessonId={activeLesson.id} loginHref={loginHref} />
          </div>
        )}
      </div>
    </main>
  );
}
