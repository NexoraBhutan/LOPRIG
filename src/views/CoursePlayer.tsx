"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Play, Pause, CheckCircle, Circle, PlayCircle,
  CaretLeft, CaretRight, Download, ArrowLeft, X, List,
} from "@phosphor-icons/react";
import { useEnrollment } from "@/context/EnrollmentContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import ProgressRing from "@/components/ProgressRing";
import EmptyState from "@/components/EmptyState";
import PageLoader from "@/components/PageLoader";
import { ApiError, api, errorMessage } from "@/lib/api";
import type { ApiCourse, ApiModule } from "@/lib/mappers";
import VideoFrame from "@/components/VideoFrame";
import { isEmbedded, type Playback } from "@/lib/video";

const SPEEDS = [1, 1.25, 1.5, 2];

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
}

interface Progress {
  completed_lessons: number;
  total_lessons: number;
  percent: number;
}

interface LearnCourse {
  /** "OPEN": a free course watched without an enrollment (visitor), so nothing is saved. */
  status: string;
  course: ApiCourse;
  progress: Progress;
  last_lesson: number | null;
  certificate: string | null;
  modules: ApiModule<PlayerLesson>[];
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
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const openedLesson = useRef<number | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  // Open sidebar by default on large screens
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setSidebarOpen(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSidebarOpen(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSidebarOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  const allLessons = useMemo(
    () => data?.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, sectionTitle: m.title }))) ?? [],
    [data]
  );

  const selectLesson = useCallback((lessonId: number) => {
    setActiveLessonId(lessonId);
    setPlaying(false);
    setResourcesOpen(false);
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

  const goTo = (idx: number) => {
    const target = allLessons[idx];
    if (target) selectLesson(target.id);
  };

  const handleComplete = async () => {
    if (!activeLesson || saving) return;
    if (!tracking) {
      if (user) push("Progress is saved for student accounts only.", "info");
      else {
        push("Log in to save your progress and earn the certificate. It's free.", "info");
        router.push(`/login?from=${encodeURIComponent(`/learn/${id}`)}`);
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
        push(`Course complete! Your certificate code is ${res.certificate}.`, "success");
      } else {
        push("Lesson marked complete!", "success");
      }
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

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
  };

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (video) {
      if (video.paused) video.play().catch(() => undefined);
      else video.pause();
      return;
    }
    if (playing) {
      setPlaying(false);
      return;
    }
    setPlaying(true);
    push("This lesson has no video yet.", "info");
  };

  const resources = activeLesson?.resources ?? [];
  // Bunny / YouTube / Vimeo players bring their own play and speed controls.
  const embedded = isEmbedded(activeLesson?.video);

  return (
    <main className="w-full bg-bg-soft min-h-[100dvh]">
      <div className="grid lg:grid-cols-[1fr_360px] h-screen">
        {/* Video Area */}
        <div className="flex flex-col">
          {/* Top bar */}
          <div className="flex items-center gap-4 px-6 py-4 bg-ink-strong text-white">
            <Link href="/my-learning" className="flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors no-underline">
              <ArrowLeft size={16} weight="bold" />
              <span className="hidden sm:inline">My Learning</span>
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{activeLesson?.title ?? course.title}</p>
              <p className="text-xs text-white/50 truncate">
                {course.title}{activeLesson?.sectionTitle ? ` · ${activeLesson.sectionTitle}` : ""}
              </p>
            </div>
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer border-none lg:hidden"
              aria-label="Toggle lesson list"
            >
              <List size={14} weight="bold" />
            </button>
            <button
              onClick={() => router.push(`/courses/${course.id}`)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer border-none"
              aria-label="Close player"
            >
              <X size={14} weight="bold" />
            </button>
          </div>

          {/* Video stage */}
          <div className="flex-1 flex items-center justify-center bg-ink-strong relative overflow-hidden">
            {activeLesson?.video.url ? (
              <VideoFrame
                key={activeLesson.id}
                playback={activeLesson.video}
                title={activeLesson.title}
                className="relative z-10 w-full h-full object-contain"
                videoRef={videoRef}
                videoProps={{
                  onPlay: () => setPlaying(true),
                  onPause: () => setPlaying(false),
                  onLoadedMetadata: (e) => {
                    e.currentTarget.playbackRate = speed;
                    if (activeLesson.position_seconds) e.currentTarget.currentTime = activeLesson.position_seconds;
                  },
                }}
              />
            ) : (
              <>
                {activeLesson && (
                  <div className="text-center relative z-10 px-6">
                    <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-4">Lesson {activeIndex + 1} of {allLessons.length}</p>
                    <h2 className="font-display text-2xl md:text-3xl text-white max-w-[640px] mx-auto leading-tight">{activeLesson.title}</h2>
                    <p className="text-white/40 text-sm mt-6 max-w-[420px] mx-auto">
                      {activeLesson.duration} · {activeLesson.sectionTitle}
                    </p>
                    {activeLesson.body && (
                      <p className="text-white/60 text-sm mt-6 max-w-[520px] mx-auto leading-relaxed">{activeLesson.body}</p>
                    )}
                  </div>
                )}

                {/* Backdrop art */}
                <img
                  src={`https://picsum.photos/seed/player${course.id}/1400/900`}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale contrast-125"
                />
                <div className="absolute inset-0 aw-dark-wash" />
              </>
            )}
          </div>

          {/* Player controls */}
          <div className="px-6 py-4 bg-white border-t border-line">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => goTo(activeIndex - 1)} disabled={activeIndex <= 0} className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-bg-soft transition-colors bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Previous lesson">
                <CaretLeft size={16} weight="bold" />
              </button>
              {!embedded && <button onClick={handlePlayPause} className="w-11 h-11 rounded-full bg-ink-strong text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer border-none flex-shrink-0" aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" className="ml-0.5" />}
              </button>}
              <button onClick={() => goTo(activeIndex + 1)} disabled={activeIndex >= allLessons.length - 1} className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-bg-soft transition-colors bg-transparent border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Next lesson">
                <CaretRight size={16} weight="bold" />
              </button>
              {!embedded && (
                <button onClick={cycleSpeed} className="text-xs font-bold text-ink-muted hover:text-ink px-2 py-1 rounded bg-transparent border-none cursor-pointer transition-colors" aria-label="Change playback speed">
                  {speed}x
                </button>
              )}

              <div className="flex-1 h-1.5 bg-bg-sunken rounded-full overflow-hidden mx-4 hidden sm:block">
                <div
                  className="h-full bg-gold rounded-full transition-all duration-300"
                  style={{ width: `${allLessons.length ? ((activeIndex + (playing ? 0.4 : 0)) / allLessons.length) * 100 : 0}%` }}
                />
              </div>

              <span className="text-xs font-bold text-ink-muted tabular-nums">
                {activeIndex + 1} / {allLessons.length}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <button
                onClick={handleComplete}
                disabled={saving}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold tracking-widest uppercase transition-all cursor-pointer border-2 disabled:cursor-wait ${
                  isCompleted
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-gold text-ink-strong border-gold hover:bg-gold-dark hover:border-gold-dark"
                }`}
              >
                <CheckCircle size={14} weight={isCompleted ? "fill" : "regular"} />
                {isCompleted ? "Completed" : saving ? "Saving…" : "Mark as complete"}
              </button>
              <div className="flex items-center gap-4">
                <span className="text-xs text-ink-muted hidden sm:inline">
                  {data.progress.completed_lessons} of {data.progress.total_lessons} lessons done
                </span>
                <ProgressRing value={progress} size={40} showValue={false} label={`${progress}% of the course complete`} />
                <span className="text-xs font-bold text-ink-strong">{progress}%</span>
              </div>
            </div>
            {data.certificate && (
              <p className="text-xs text-emerald-700 font-bold mt-4">
                Certificate earned · code {data.certificate}
              </p>
            )}
          </div>
        </div>

        {/* Lesson sidebar */}
        <aside className={`${sidebarOpen ? "fixed inset-y-0 right-0 z-50 w-[320px] lg:static lg:w-auto lg:z-auto" : "hidden"} bg-white border-l border-line overflow-y-auto`}>
          <div className="p-6 border-b border-line sticky top-0 bg-white z-10">
            <h3 className="text-sm font-bold text-ink-strong mb-1">Course content</h3>
            <p className="text-xs text-ink-muted">{allLessons.length} lessons &middot; {progress}% complete</p>
            <div className="h-1.5 bg-bg-sunken rounded-full overflow-hidden mt-4">
              <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <nav aria-label="Lessons">
            {data.modules.map((section) => (
              <div key={section.id}>
                <p className="px-6 py-3 bg-bg-soft text-xs font-bold text-ink-strong uppercase tracking-wider border-b border-line">
                  {section.title}
                </p>
                <ul>
                  {section.lessons.map((l) => {
                    const active = l.id === activeLessonId;
                    return (
                      <li key={l.id}>
                        <button
                          onClick={() => { selectLesson(l.id); setSidebarOpen(false); }}
                          className={`w-full flex items-start gap-3 px-6 py-4 text-left transition-colors cursor-pointer border-none bg-transparent border-b border-line hover:bg-bg-soft ${active ? "bg-gold-soft/60 border-l-[3px] border-l-gold" : ""}`}
                          aria-current={active ? "true" : undefined}
                        >
                          {l.completed ? (
                            <CheckCircle size={16} weight="fill" className="text-emerald-500 flex-shrink-0 mt-0.5" />
                          ) : active ? (
                            <PlayCircle size={16} weight="fill" className="text-gold-dark flex-shrink-0 mt-0.5" />
                          ) : (
                            <Circle size={16} className="text-line-strong flex-shrink-0 mt-0.5" />
                          )}
                          <span className="flex-1 min-w-0">
                            <span className={`block text-xs leading-relaxed ${active ? "font-bold text-ink-strong" : "text-ink"}`}>{l.title}</span>
                            <span className="block text-[0.65rem] text-ink-muted mt-1">{l.duration}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="p-6 border-t border-line">
            <button
              onClick={() => setResourcesOpen((o) => !o)}
              disabled={!resources.length}
              aria-expanded={resourcesOpen}
              className="flex items-center justify-center gap-2 w-full bg-bg-soft border-2 border-line rounded-xl py-3.5 text-xs font-bold text-ink-strong hover:border-gold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} weight="bold" /> {resources.length ? "Download resources" : "No resources for this lesson"}
            </button>
            {resourcesOpen && resources.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {resources.map((r) => (
                  <li key={r.id}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-gold-dark hover:text-gold">
                      {r.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
