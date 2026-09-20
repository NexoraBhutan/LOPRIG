import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Users, ChartBar, Globe, CheckCircle, PlayCircle, Download, Infinity as InfinityIcon,
  Trophy, CaretDown, Heart, Star,
} from "@phosphor-icons/react";
import CourseThumb from "../components/CourseThumb";
import Rating from "../components/Rating";
import CourseCard from "../components/CourseCard";
import EmptyState from "../components/EmptyState";
import { getCourseById, courses } from "../data/courses";
import { useEnrollment } from "../context/EnrollmentContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

function ratingBreakdown(rating) {
  const clamped = Math.min(5, Math.max(1, rating));
  const decay = 0.35 + (5 - clamped) * 0.25;
  const weights = [1, decay, decay ** 2, decay ** 3, decay ** 4];
  const total = weights.reduce((s, w) => s + w, 0);
  return weights.map((w) => Math.round((w / total) * 100));
}

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

export default function CourseDetails() {
  const { id } = useParams();
  const course = getCourseById(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isEnrolled, toggleSaved, enrollments } = useEnrollment();
  const { push } = useToast();
  const [openSections, setOpenSections] = useState({ s1: true });

  const related = useMemo(
    () => courses.filter((c) => c.category === course?.category && c.id !== course?.id).slice(0, 4),
    [course]
  );

  if (!course) {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center px-8">
        <EmptyState
          pose="sad"
          title="Course not found"
          ctaLabel="Browse courses"
          ctaTo="/courses"
        />
      </div>
    );
  }

  const enrolled = isEnrolled(course.id);
  const saved = Boolean(enrollments[course.id]?.saved);
  const totalLessons = course.curriculum.reduce((s, sec) => s + sec.lessons.length, 0);

  const handleEnroll = () => {
    if (!user) {
      push("Please log in to enroll in this course.", "info");
      navigate("/login", { state: { from: `/courses/${course.id}` } });
      return;
    }
    if (enrolled) {
      navigate(`/learn/${course.id}`);
      return;
    }
    navigate(`/checkout/${course.id}`);
  };

  const handleSave = () => {
    if (!user) {
      push("Log in to save courses to your list.", "info");
      return;
    }
    toggleSaved(course.id);
    push(saved ? "Removed from saved courses" : "Saved to your list", "success");
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full">

      {/* HERO — Wide editorial, 2-3 line max */}
      <section className="min-h-[88dvh] flex items-center px-8 lg:px-16 pt-36 pb-20 bg-white aw-gold-wash">
        <div className="max-w-[1280px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-16 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-gold-dark mb-6 before:content-[''] before:w-6 before:h-[3px] before:bg-gold">
              {course.category.replace("-", " ")} &middot; {course.level}
            </span>
            <h1 className="aw-hero-h1 font-display text-ink-strong w-full max-w-5xl mb-6" style={{ fontSize: "clamp(2.2rem,4vw,3.8rem)" }}>
              {course.title}
            </h1>
            <p className="text-ink-muted text-lg leading-relaxed max-w-[640px] mb-8">{course.description}</p>

            <div className="flex flex-wrap items-center gap-5 text-sm text-ink-muted mb-6">
              <Rating value={course.rating} count={course.students} />
              <span className="flex items-center gap-1.5"><Users size={15} /> {course.students.toLocaleString()} students</span>
              <span className="flex items-center gap-1.5"><Clock size={15} /> {course.duration}</span>
              <span className="flex items-center gap-1.5"><ChartBar size={15} /> {course.level}</span>
              <span className="flex items-center gap-1.5"><Globe size={15} /> {course.language}</span>
            </div>

            <p className="text-sm text-ink-muted">
              Created by <strong className="text-ink-strong">{course.instructor.name}</strong>, {course.instructor.title}
            </p>
          </motion.div>

          {/* BUY CARD */}
          <motion.div
            initial={{ opacity: 0, x: 50, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="lg:sticky lg:top-32"
          >
            <div className="bg-white border-2 border-line rounded-xl overflow-hidden shadow-elevated">
              <CourseThumb course={course} />
              <div className="p-7">
                <div className="flex items-baseline gap-3 mb-5">
                  <strong className="text-2xl font-bold text-ink-strong">Nu. {course.discountPrice.toLocaleString()}</strong>
                  {course.discountPrice < course.price && (
                    <>
                      <span className="text-sm text-ink-muted line-through">Nu. {course.price.toLocaleString()}</span>
                      <span className="bg-red-soft text-red text-[0.65rem] font-bold px-2 py-0.5 rounded">{Math.round((1 - course.discountPrice / course.price) * 100)}% off</span>
                    </>
                  )}
                </div>

                {enrolled ? (
                  <Link to={`/learn/${course.id}`} className="btn btn-primary btn-lg btn-block">
                    <PlayCircle size={17} /> Go to Course
                  </Link>
                ) : (
                  <button className="btn btn-primary btn-lg btn-block" onClick={handleEnroll}>
                    Enroll Now
                  </button>
                )}

                <button
                  className="flex items-center justify-center gap-2 w-full mt-4 bg-transparent border-none text-sm font-bold text-gold-dark hover:text-gold transition-colors cursor-pointer"
                  onClick={handleSave}
                >
                  <Heart size={14} weight={saved ? "fill" : "regular"} /> {saved ? "Saved" : "Save for later"}
                </button>

                <ul className="flex flex-col gap-3 mt-6 pt-6 border-t border-line text-sm text-ink-muted">
                  <li className="flex items-center gap-2.5"><PlayCircle size={15} className="text-gold-dark" /> {course.duration} on-demand video</li>
                  <li className="flex items-center gap-2.5"><CheckCircle size={15} className="text-gold-dark" /> {totalLessons} lessons</li>
                  <li className="flex items-center gap-2.5"><Download size={15} className="text-gold-dark" /> Downloadable resources</li>
                  <li className="flex items-center gap-2.5"><Trophy size={15} className="text-gold-dark" /> Certificate of completion</li>
                  <li className="flex items-center gap-2.5"><InfinityIcon size={15} className="text-gold-dark" /> Lifetime access</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* DETAILS BODY */}
      <section className="py-32 md:py-48 px-8 lg:px-16 bg-bg-soft">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-16">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="flex flex-col gap-16"
          >
            {/* What you'll learn */}
            <motion.div variants={fadeUp}>
              <h2 className="text-2xl md:text-3xl tracking-tighter font-medium text-ink-strong mb-8">What you&apos;ll learn</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {course.whatYouLearn.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-ink">
                    <CheckCircle size={18} weight="fill" className="text-gold-dark mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Curriculum */}
            <motion.div variants={fadeUp}>
              <h2 className="text-2xl md:text-3xl tracking-tighter font-medium text-ink-strong mb-3">Course curriculum</h2>
              <p className="text-sm text-ink-muted mb-8">{course.curriculum.length} sections &middot; {totalLessons} lessons &middot; {course.duration} total</p>
              <div className="flex flex-col gap-2">
                {course.curriculum.map((section) => (
                  <div key={section.id} className="border-2 border-line rounded-xl bg-white overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between gap-4 px-6 py-4 bg-transparent border-none cursor-pointer text-left font-semibold text-ink-strong hover:bg-bg-soft transition-colors"
                      onClick={() => setOpenSections((s) => ({ ...s, [section.id]: !s[section.id] }))}
                      aria-expanded={!!openSections[section.id]}
                    >
                      <span>{section.title}</span>
                      <span className="flex items-center gap-3 text-xs font-normal text-ink-muted">
                        {section.lessons.length} lessons
                        <CaretDown size={14} className={`transition-transform duration-200 ${openSections[section.id] ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    <AnimatePresence>
                      {openSections[section.id] && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          {section.lessons.map((l) => (
                            <li key={l.id} className="flex items-center justify-between px-6 py-3 border-t border-line text-sm text-ink">
                              <span className="flex items-center gap-2.5"><PlayCircle size={13} className="text-ink-muted" /> {l.title}</span>
                              <span className="text-xs text-ink-muted">{l.duration}</span>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Requirements */}
            <motion.div variants={fadeUp}>
              <h2 className="text-2xl md:text-3xl tracking-tighter font-medium text-ink-strong mb-6">Requirements</h2>
              <ul className="flex flex-col gap-3">
                {course.requirements.map((r) => (
                  <li key={r} className="flex items-start gap-3 text-sm text-ink">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold-dark mt-2 flex-shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Description */}
            <motion.div variants={fadeUp}>
              <h2 className="text-2xl md:text-3xl tracking-tighter font-medium text-ink-strong mb-6">Description</h2>
              <p className="text-ink-muted leading-relaxed">{course.description}</p>
            </motion.div>

            {/* Who this is for */}
            <motion.div variants={fadeUp}>
              <h2 className="text-2xl md:text-3xl tracking-tighter font-medium text-ink-strong mb-6">Who this course is for</h2>
              <p className="text-ink-muted leading-relaxed">
                Students, working professionals, and lifelong learners in Bhutan who want practical,
                job-ready {course.category.replace("-", " ")} skills, no matter their starting point.
              </p>
            </motion.div>

            {/* Reviews */}
            <motion.div variants={fadeUp}>
              <h2 className="text-2xl md:text-3xl tracking-tighter font-medium text-ink-strong mb-8">Student reviews</h2>
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-8 mb-8">
                <div className="flex flex-col items-center justify-center py-8 bg-white border-2 border-line rounded-xl">
                  <strong className="text-4xl font-bold text-ink-strong">{course.rating.toFixed(1)}</strong>
                  <div className="flex gap-0.5 my-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={15} weight={i < Math.round(course.rating) ? "fill" : "regular"} className="text-gold" />
                    ))}
                  </div>
                  <span className="text-xs text-ink-muted">Course rating</span>
                </div>
                <div className="flex flex-col gap-2.5 justify-center">
                  {ratingBreakdown(course.rating).map((pct, i) => (
                    <div key={5 - i} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-ink-strong w-8">{5 - i} <Star size={10} weight="fill" className="text-gold inline" /></span>
                      <div className="flex-1 h-2 bg-bg-sunken rounded-full overflow-hidden">
                        <div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-ink-muted w-10 text-right">{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-5">
                {[
                  { name: "Sonam Choki", text: "Very clear explanations and practical exercises. Helped me a lot with my studies.", rating: 5, color: "bg-ink-strong" },
                  { name: "Pema Tobgay", text: "Good pacing and the instructor explains concepts step by step.", rating: 4.5, color: "bg-gold-dark" },
                ].map((r) => (
                  <div key={r.name} className="flex gap-4 p-6 bg-white border-2 border-line rounded-xl">
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${r.color}`}>
                      {r.name.charAt(0)}
                    </span>
                    <div>
                      <div className="flex items-center gap-3 mb-1.5">
                        <strong className="text-sm text-ink-strong">{r.name}</strong>
                        <Rating value={r.rating} showCount={false} size={12} />
                      </div>
                      <p className="text-sm text-ink-muted leading-relaxed">{r.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Sticky sidebar spacer */}
          <div className="hidden lg:block" />
        </div>
      </section>

      {/* RELATED */}
      {related.length > 0 && (
        <section className="py-32 md:py-48 px-8 lg:px-16 bg-white">
          <div className="max-w-[1280px] mx-auto">
            <motion.h2
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
              variants={fadeUp} transition={{ duration: 0.6 }}
              className="text-3xl md:text-5xl tracking-tighter font-medium text-ink-strong mb-20"
            >
              Related Courses
            </motion.h2>
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
              variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6"
            >
              {related.map((c) => (
                <motion.div key={c.id} variants={fadeUp}>
                  <CourseCard course={c} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}
    </main>
  );
}
