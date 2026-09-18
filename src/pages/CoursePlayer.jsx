import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FaPlay, FaPause, FaCheckCircle, FaRegCircle, FaPlayCircle,
  FaChevronLeft, FaChevronRight, FaDownload, FaArrowLeft, FaTimes, FaBars,
} from "react-icons/fa";
import { getCourseById } from "../data/courses";
import { useEnrollment } from "../context/EnrollmentContext";
import { useToast } from "../context/ToastContext";
import ProgressRing from "../components/ProgressRing";
import Mascot from "../components/Mascot";

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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (id && activeLessonId) setLastLesson(id, activeLessonId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLessonId]);

  if (!course) {
    return (
      <div className="container page-enter player-guard">
        <div className="empty-state player-guard-state">
          <Mascot pose="sad" size={100} />
          <h3>Course not found</h3>
          <p>This lesson link may be out of date. Try browsing the catalog instead.</p>
          <Link to="/courses" className="btn btn-primary">Browse Courses</Link>
        </div>
      </div>
    );
  }

  if (!isEnrolled(id)) {
    return (
      <div className="container page-enter player-guard">
        <div className="empty-state player-guard-state">
          <Mascot pose="thinking" size={100} />
          <h3>You're not enrolled in this course yet</h3>
          <p>Enroll to unlock the full video curriculum and track your progress here.</p>
          <Link to={`/courses/${id}`} className="btn btn-primary">View Course</Link>
        </div>
      </div>
    );
  }

  const activeIndex = allLessons.findIndex((l) => l.id === activeLessonId);
  const activeLesson = allLessons[activeIndex];
  const completed = record?.completedLessons || [];
  const progress = getProgress(id);

  const goTo = (lessonId) => {
    setActiveLessonId(lessonId);
    setPlaying(false);
  };

  const goNext = () => activeIndex < allLessons.length - 1 && goTo(allLessons[activeIndex + 1].id);
  const goPrev = () => activeIndex > 0 && goTo(allLessons[activeIndex - 1].id);

  const handleComplete = () => {
    markLessonComplete(id, activeLessonId);
    push("Lesson marked as complete", "success");
    if (activeIndex < allLessons.length - 1) goNext();
  };

  const handleLessonKeyDown = (e, lessonId) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goTo(lessonId);
    }
  };

  return (
    <div className="player-page page-enter">
      <div className="player-topbar">
        <Link to={`/courses/${id}`} className="player-back"><FaArrowLeft size={16} /> {course.title}</Link>
        <div className="player-progress-mini">
          <ProgressRing value={progress} size={40} label={`Course progress: ${progress}% complete`} />
          <span>Course progress</span>
        </div>
        <button className="icon-btn player-sidebar-toggle" onClick={() => setSidebarOpen((s) => !s)} aria-label="Toggle curriculum">
          {sidebarOpen ? <FaTimes size={16} /> : <FaBars size={17} />}
        </button>
      </div>

      <div className="player-body">
        <div className="player-main">
          <div className="video-shell">
            <div className="video-fake">
              <div className="video-fake-bg" style={{ background: `linear-gradient(135deg, ${course.gradient[0]}, ${course.gradient[1]})` }} />
              <button className="video-play-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
                {playing ? <FaPause size={26} /> : <FaPlay size={26} />}
              </button>
              <span className="video-lesson-label">{activeLesson?.title}</span>
            </div>
            <div className="video-controls">
              <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
                {playing ? <FaPause size={15} /> : <FaPlay size={15} />}
              </button>
              <div className="video-scrubber">
                <div className="video-scrubber-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="video-time">{activeLesson?.duration}</span>
              <button className="speed-btn" onClick={() => setSpeed((s) => (s >= 2 ? 0.5 : s + 0.25))}>{speed}x</button>
            </div>
          </div>

          <div className="lesson-info card-plain">
            <div className="lesson-info-head">
              <h2>{activeLesson?.title}</h2>
              <button className="btn btn-primary btn-sm" onClick={handleComplete}>
                <FaCheckCircle size={13} /> Mark as Complete
              </button>
            </div>
            <p className="lesson-info-desc">
              This lesson covers "{activeLesson?.title}" from {activeLesson?.sectionTitle}. Follow along and practice
              the concepts shown before moving to the next lesson.
            </p>
            <button className="resource-link"><FaDownload size={14} /> Download lesson resources</button>

            <div className="lesson-nav">
              <button className="btn btn-outline btn-sm" onClick={goPrev} disabled={activeIndex === 0}><FaChevronLeft size={13} /> Previous</button>
              <button className="btn btn-outline btn-sm" onClick={goNext} disabled={activeIndex === allLessons.length - 1}>Next <FaChevronRight size={13} /></button>
            </div>
          </div>
        </div>

        {sidebarOpen && (
          <aside className="player-sidebar">
            <div className="player-sidebar-head">
              <h3>Course Content</h3>
              <span>{completed.length}/{allLessons.length} completed</span>
            </div>
            <div className="curriculum-list">
              {course.curriculum.map((section) => (
                <div className="curriculum-section" key={section.id}>
                  <div className="curriculum-section-head" style={{ cursor: "default" }}>
                    <span>{section.title}</span>
                  </div>
                  <ul>
                    {section.lessons.map((l) => {
                      const isActive = l.id === activeLessonId;
                      const isDone = completed.includes(l.id);
                      return (
                        <li
                          key={l.id}
                          className={`player-lesson-item ${isActive ? "active" : ""}`}
                          onClick={() => goTo(l.id)}
                          onKeyDown={(e) => handleLessonKeyDown(e, l.id)}
                          role="button"
                          tabIndex={0}
                        >
                          {isDone ? <FaCheckCircle size={14} className="lesson-done" /> : isActive ? <FaPlayCircle size={14} /> : <FaRegCircle size={13} />}
                          {l.title}
                          <span>{l.duration}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
