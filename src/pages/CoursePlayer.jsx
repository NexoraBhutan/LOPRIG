import { useMemo, useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Play, Pause, CheckCircle, Circle, PlayCircle,
  CaretLeft, CaretRight, Download, ArrowLeft, X, List,
} from "@phosphor-icons/react";
import { getCourseById } from "../data/courses";
import { useEnrollment } from "../context/EnrollmentContext";
import { useToast } from "../context/ToastContext";
import ProgressRing from "../components/ProgressRing";
import EmptyState from "../components/EmptyState";

export default function CoursePlayer() {
  const { id } = useParams();
  const course = getCourseById(id);
  const { enrollments, isEnrolled, markLessonComplete, setLastLesson, getProgress } = useEnrollment();
  const { push } = useToast();

  const allLessons = useMemo(
    () => course?.curriculum.flatMap((s) => s.lessons.map((l) => ({ ...l, sectionTitle: s.title }))) || [],
    [course]
  );

  const record = enrollments[id];
  const initialLesson = record?.lastLesson || allLessons[0]?.id;
  const [activeLessonId, setActiveLessonId] = useState(initialLesson);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (id && activeLessonId) setLastLesson(id, activeLessonId);
  }, [activeLessonId, id, setLastLesson]);

  // Open sidebar by default on large screens
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setSidebarOpen(mq.matches);
    const handler = (e) => setSidebarOpen(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!course) {
    return (
      <div className="min-h-[80dvh] flex items-center justify-center px-8">
        <h1 className="visually-hidden">Course not found</h1>
        <EmptyState
          pose="sad"
          title="Course not found"
          description="This lesson link may be out of date. Try browsing the catalog instead."
          ctaLabel="Browse Courses"
          ctaTo="/courses"
        />
      </div>
    );
  }

  if (!isEnrolled(id)) {
    return (
      <div className="min-h-[80dvh] flex items-center justify-center px-8">
        <h1 className="visually-hidden">{course.title} — course player</h1>
        <EmptyState
          pose="thinking"
          title="You're not enrolled in this course yet"
          description="Enroll to unlock the full video curriculum and track your progress here."
          ctaLabel="View Course"
          ctaTo={`/courses/${id}`}
        />
      </div>
    );
  }

  const activeIndex = allLessons.findIndex((l) => l.id === activeLessonId);
  const activeLesson = allLessons[activeIndex];
  const completed = record?.completedLessons || [];
  const progress = getProgress(id);

  const goTo = (lessonId) => { setActiveLessonId(lessonId); setPlaying(false); };
  const goNext = () => activeIndex < allLessons.length - 1 && goTo(allLessons[activeIndex + 1].id);
  const goPrev = () => activeIndex > 0 && goTo(allLessons[activeIndex - 1].id);

  const handleComplete = () => {
    markLessonComplete(id, activeLessonId);
    push("Lesson marked as complete", "success");
    if (activeIndex < allLessons.length - 1) goNext();
  };

  const handleLessonKeyDown = (e, lessonId) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goTo(lessonId); }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-ink-strong">
      <h1 className="visually-hidden">{course.title} — {activeLesson?.title}</h1>

      {/* Topbar */}
      <div className="flex items-center justify-between px-6 lg:px-8 py-3 bg-ink-strong border-b border-white/10">
        <Link to={`/courses/${id}`} className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors no-underline">
          <ArrowLeft size={16} /> <span className="hidden sm:inline">{course.title}</span>
        </Link>
        <div className="flex items-center gap-3">
          <ProgressRing value={progress} size={36} label={`Course progress: ${progress}% complete`} />
          <span className="text-xs text-white/50 hidden sm:block">Course progress</span>
        </div>
        <button
          className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors cursor-pointer border-none"
          onClick={() => setSidebarOpen((s) => !s)}
          aria-label="Toggle curriculum"
        >
          {sidebarOpen ? <X size={16} /> : <List size={17} />}
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-y-auto min-w-0">
          {/* Video Shell */}
          <div className="relative w-full aspect-video bg-black overflow-hidden group/vid">
            <img
              src={`https://picsum.photos/seed/lesson${activeLessonId}/1280/720`}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover opacity-50 grayscale-[30%] contrast-125"
            />
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${course.gradient[0]}, ${course.gradient[1]})`, opacity: 0.35 }} />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.55)_100%)]" />
            <button
              className="absolute inset-0 flex items-center justify-center w-full h-full bg-transparent border-none cursor-pointer group"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause" : "Play"}
            >
              <span className="w-20 h-20 rounded-full bg-gold flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-glow">
                {playing ? <Pause size={30} className="text-ink-strong" /> : <Play size={30} className="text-ink-strong ml-1" />}
              </span>
            </button>
            <span className="absolute bottom-6 left-6 text-white/80 text-sm font-medium bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">{activeLesson?.title}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 sm:gap-4 px-6 lg:px-8 py-3 bg-ink-strong border-b border-white/10">
            <button onClick={() => setPlaying((p) => !p)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors cursor-pointer border-none" aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
            </button>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-white/50 w-12 text-right">{activeLesson?.duration}</span>
            <button
              className="px-2.5 py-1 rounded bg-white/10 text-xs text-white font-bold hover:bg-white/20 transition-colors cursor-pointer border-none"
              onClick={() => setSpeed((s) => (s >= 2 ? 0.5 : s + 0.25))}
            >
              {speed}x
            </button>
          </div>

          {/* Lesson Info */}
          <div className="px-6 lg:px-8 py-8">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 className="text-xl font-semibold text-white">{activeLesson?.title}</h2>
              <button
                className="btn btn-primary btn-sm flex-shrink-0"
                onClick={handleComplete}
              >
                <CheckCircle size={13} /> Mark as Complete
              </button>
            </div>
            <p className="text-sm text-white/50 leading-relaxed mb-6">
              This lesson covers &ldquo;{activeLesson?.title}&rdquo; from {activeLesson?.sectionTitle}. Follow along and practice
              the concepts shown before moving to the next lesson.
            </p>
            <button className="inline-flex items-center gap-2 text-sm text-gold-dark font-bold hover:text-gold transition-colors bg-transparent border-none cursor-pointer mb-8">
              <Download size={14} /> Download lesson resources
            </button>

            <div className="flex gap-3">
              <button
                className="btn btn-sm"
                style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)' }}
                onClick={goPrev}
                disabled={activeIndex === 0}
              >
                <CaretLeft size={13} /> Previous
              </button>
              <button
                className="btn btn-sm"
                style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)' }}
                onClick={goNext}
                disabled={activeIndex === allLessons.length - 1}
              >
                Next <CaretRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar — responsive overlay on mobile, fixed on desktop */}
        {sidebarOpen && (
          <>
            <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
            <aside className="fixed right-0 top-0 bottom-0 w-[320px] z-40 bg-[#1e1e1e] border-l border-white/10 overflow-y-auto lg:relative lg:w-[340px] lg:flex-shrink-0 lg:z-auto">
              <div className="flex items-center justify-between px-5 lg:px-6 py-4 border-b border-white/10">
                <h3 className="text-sm font-bold text-white">Course Content</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/40">{completed.length}/{allLessons.length} completed</span>
                  <button className="lg:hidden w-7 h-7 rounded bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors cursor-pointer border-none" onClick={() => setSidebarOpen(false)} aria-label="Close curriculum">
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col">
                {course.curriculum.map((section) => (
                  <div key={section.id}>
                    <div className="px-5 py-3 text-xs font-bold text-white/60 uppercase tracking-wider bg-white/5">{section.title}</div>
                    {section.lessons.map((l) => {
                      const isActive = l.id === activeLessonId;
                      const isDone = completed.includes(l.id);
                      return (
                        <button
                          key={l.id}
                          className={`w-full flex items-center gap-3 px-5 py-3 text-left border-b border-white/5 cursor-pointer transition-colors border-x-0 border-t-0 ${
                            isActive ? "bg-white/10 text-white" : "bg-transparent text-white/60 hover:bg-white/5 hover:text-white"
                          }`}
                          onClick={() => goTo(l.id)}
                          onKeyDown={(e) => handleLessonKeyDown(e, l.id)}
                          role="button"
                          tabIndex={0}
                        >
                          {isDone ? <CheckCircle size={14} weight="fill" className="text-emerald-400 flex-shrink-0" /> : isActive ? <PlayCircle size={14} weight="fill" className="text-gold flex-shrink-0" /> : <Circle size={13} className="text-white/30 flex-shrink-0" />}
                          <span className="text-sm flex-1 leading-snug">{l.title}</span>
                          <span className="text-xs text-white/30 flex-shrink-0">{l.duration}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
