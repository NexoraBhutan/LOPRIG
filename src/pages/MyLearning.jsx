import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PlayCircle, Bookmark } from "@phosphor-icons/react";
import { useEnrollment } from "../context/EnrollmentContext";
import CourseThumb from "../components/CourseThumb";
import ProgressBar from "../components/ProgressBar";
import ProgressRing from "../components/ProgressRing";
import EmptyState from "../components/EmptyState";

const TABS = ["All", "In Progress", "Completed", "Saved"];
const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

export default function MyLearning() {
  const { enrollments, enrolledCourses, savedCourses, isEnrolled, getProgress } = useEnrollment();
  const [tab, setTab] = useState("All");

  const items = useMemo(() => {
    const withProgress = enrolledCourses.map((c) => ({ course: c, progress: getProgress(c.id) }));
    if (tab === "In Progress") return withProgress.filter((x) => x.progress < 100);
    if (tab === "Completed") return withProgress.filter((x) => x.progress === 100);
    if (tab === "Saved") return savedCourses.map((c) => ({ course: c, progress: getProgress(c.id) }));
    return withProgress;
  }, [tab, enrolledCourses, savedCourses, getProgress]);

  const continueCourse = useMemo(() => {
    const inProgress = enrolledCourses
      .map((c) => ({ course: c, progress: getProgress(c.id) }))
      .sort((a, b) => a.progress - b.progress);
    return inProgress.find((c) => c.progress < 100) || inProgress[0];
  }, [enrolledCourses, getProgress]);

  return (
    <main className="overflow-x-hidden w-full max-w-full px-8 lg:px-16 pt-32 pb-40">
      <div className="max-w-[1280px] mx-auto">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-16"
        >
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-gold-dark mb-4 before:content-[''] before:w-6 before:h-[3px] before:bg-gold">
            My Learning
          </span>
          <h1 className="text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong mb-2">Track your progress</h1>
          <p className="text-ink-muted text-lg">Jump back into your courses and keep building.</p>
        </motion.div>

        {/* Continue Card */}
        {tab === "All" && continueCourse && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mb-12"
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-0 bg-white border-2 border-line rounded-xl overflow-hidden">
              <CourseThumb course={continueCourse.course} className="!aspect-auto !min-h-[220px]" />
              <div className="p-8 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[0.7rem] font-bold text-gold-dark uppercase tracking-wider">Continue learning</span>
                    <h2 className="text-lg font-semibold mt-1">{continueCourse.course.title}</h2>
                    <p className="text-sm text-ink-muted mt-1">
                      {enrollments[continueCourse.course.id]?.lastLesson
                        ? "Pick up where you left off"
                        : "Ready to start your first lesson"}
                    </p>
                  </div>
                  <ProgressRing value={continueCourse.progress} size={64} label={`${continueCourse.progress}% complete`} />
                </div>
                <Link to={`/learn/${continueCourse.course.id}`} className="btn btn-primary self-start mt-2">
                  <PlayCircle size={15} /> Continue Learning
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-10 border-b-2 border-line pb-px overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer bg-transparent ${
                tab === t
                  ? "border-gold text-gold-dark"
                  : "border-transparent text-ink-muted hover:text-ink-strong"
              }`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Grid */}
        {items.length ? (
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {items.map(({ course, progress }) => {
              const enrolled = isEnrolled(course.id);
              return (
                <motion.div key={course.id} variants={fadeUp} className="bg-white border-2 border-line rounded-xl overflow-hidden hover:border-gold hover:shadow-[0_8px_32px_rgba(255,182,6,0.1)] transition-all duration-300">
                  <CourseThumb course={course} />
                  <div className="p-5 flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-ink-strong leading-snug line-clamp-2">{course.title}</h3>
                    {enrolled ? (
                      <>
                        <p className="text-xs text-ink-muted">
                          {enrollments[course.id]?.lastLesson ? "Last watched a lesson" : "Not started yet"}
                        </p>
                        <ProgressBar value={progress} />
                        <Link to={`/learn/${course.id}`} className="btn btn-primary btn-sm mt-1">
                          <PlayCircle size={14} /> {progress > 0 ? "Continue" : "Start"} Learning
                        </Link>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-ink-muted flex items-center gap-1.5">
                          <Bookmark size={12} weight="fill" className="text-gold-dark" /> Saved &middot; not enrolled yet
                        </p>
                        <Link to={`/courses/${course.id}`} className="btn btn-outline-neutral btn-sm mt-1">
                          View Course
                        </Link>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <EmptyState
            pose="sad"
            title="Nothing here yet"
            description="Courses you enroll in or save will show up in this tab."
            ctaLabel="Browse Courses"
            ctaTo="/courses"
          />
        )}
      </div>
    </main>
  );
}
