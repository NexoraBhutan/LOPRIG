import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { PlayCircle, Bookmark, Fire, Diamond } from "@phosphor-icons/react";
import { useEnrollment } from "../context/EnrollmentContext";
import CourseThumb from "../components/CourseThumb";
import ProgressBar from "../components/ProgressBar";
import ProgressRing from "../components/ProgressRing";
import EmptyState from "../components/EmptyState";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const TABS = ["All", "In Progress", "Completed", "Saved"];
const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

export default function MyLearning() {
  const { enrollments, enrolledCourses, savedCourses, isEnrolled, getProgress, streak, xp } = useEnrollment();
  const [tab, setTab] = useState("All");
  const rootRef = useRef(null);

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

  useGSAP(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(".ml-art", { scale: 1.15 }, {
        scale: 1, ease: "none",
        scrollTrigger: { trigger: ".ml-band", start: "top top", end: "bottom top", scrub: 0.8 },
      });
      gsap.to(".ml-art-wrap", {
        opacity: 0.2, ease: "none",
        scrollTrigger: { trigger: ".ml-band", start: "center 60%", end: "bottom top", scrub: 0.8 },
      });
    }, rootRef);
    return () => ctx.revert();
  }, { scope: rootRef });

  return (
    <main ref={rootRef} className="overflow-x-hidden w-full max-w-full">

      {/* ATTENTION — Cinematic band with inline-pill headline */}
      <section className="ml-band relative px-8 lg:px-16 pt-40 pb-44 bg-ink-strong overflow-hidden">
        <div className="ml-art-wrap absolute inset-0 overflow-hidden">
          <img
            src="https://picsum.photos/seed/studyjourney/1920/800"
            alt=""
            aria-hidden="true"
            className="ml-art w-full h-full object-cover grayscale contrast-125 opacity-90"
          />
          <div className="absolute inset-0 aw-dark-wash" />
        </div>

        <div className="max-w-[1280px] mx-auto w-full relative">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col lg:flex-row lg:items-end justify-between gap-8"
          >
            <div>
              <h1 className="aw-hero-h1 font-display text-white w-full max-w-6xl" style={{ fontSize: "clamp(2.4rem,4.5vw,4.2rem)" }}>
                Track your
                <span className="aw-inline-pill mx-3" style={{ backgroundImage: "url(https://picsum.photos/seed/progress/400/200)" }} aria-hidden="true" />
                progress
              </h1>
              <p className="text-white/70 text-lg mt-5 max-w-[520px]">Jump back into your courses and keep building momentum.</p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-full" title={`${streak}-day streak`}>
                <Fire size={15} weight="fill" className="text-gold" /> {streak}-day streak
              </span>
              <span className="inline-flex items-center gap-2 bg-gold text-ink-strong text-xs font-bold px-4 py-2.5 rounded-full" title={`${xp} XP earned`}>
                <Diamond size={14} weight="fill" /> {xp} XP
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* INTEREST — Continue card overlapping the band */}
      <section className="px-8 lg:px-16 pb-32 md:pb-48 bg-bg-soft">
        <div className="max-w-[1280px] mx-auto">
          {tab === "All" && continueCourse && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="relative lg:-mt-24 mb-14"
            >
              <div className="group grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-0 bg-white border-2 border-line rounded-3xl overflow-hidden shadow-elevated hover:border-gold transition-colors duration-300">
                <div className="overflow-hidden min-h-[220px]">
                  <CourseThumb course={continueCourse.course} className="!aspect-auto !min-h-[220px] !h-full !rounded-none transition-transform duration-700 ease-out group-hover:scale-[1.02]" />
                </div>
                <div className="p-8 md:p-10 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="inline-block text-[0.7rem] font-bold text-gold-dark uppercase tracking-widest bg-gold-soft px-3 py-1.5 rounded-full">Continue learning</span>
                      <h2 className="font-display text-xl md:text-2xl font-semibold mt-3">{continueCourse.course.title}</h2>
                      <p className="text-sm text-ink-muted mt-1">
                        {enrollments[continueCourse.course.id]?.lastLesson
                          ? "Pick up where you left off"
                          : "Ready to start your first lesson"}
                      </p>
                    </div>
                    <ProgressRing value={continueCourse.progress} size={72} label={`${continueCourse.progress}% complete`} />
                  </div>
                  <ProgressBar value={continueCourse.progress} />
                  <Link to={`/learn/${continueCourse.course.id}`} className="btn btn-primary btn-lg self-start mt-2">
                    <PlayCircle size={15} /> Continue Learning
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tabs */}
          <div className={`relative flex gap-2 mb-10 overflow-x-auto bg-white border border-line rounded-full p-1.5 w-fit max-w-full ${tab === "All" && continueCourse ? "" : "mt-4 lg:-mt-24 lg:mb-14"}`} role="tablist" aria-label="Learning filters">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={`px-5 py-2.5 text-sm font-bold rounded-full whitespace-nowrap transition-all cursor-pointer border-none ${
                  tab === t
                    ? "bg-ink-strong text-white shadow-soft"
                    : "bg-transparent text-ink-muted hover:text-ink-strong"
                }`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Gapless grid */}
          {items.length ? (
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
              variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 grid-flow-dense"
            >
              {items.map(({ course, progress }) => {
                const enrolled = isEnrolled(course.id);
                return (
                  <motion.div key={course.id} variants={fadeUp} className="group bg-white border-2 border-line rounded-2xl overflow-hidden hover:border-gold hover:shadow-[0_8px_32px_rgba(255,182,6,0.1)] hover:-translate-y-1 transition-all duration-300">
                    <div className="overflow-hidden">
                      <CourseThumb course={course} className="!rounded-none transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                    </div>
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
      </section>
    </main>
  );
}
