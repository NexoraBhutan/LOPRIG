"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Users, ChartBar, Globe, CheckCircle, PlayCircle, Download, Infinity as InfinityIcon,
  Trophy, CaretDown, CaretRight, Heart, Star, ArrowRight,
} from "@phosphor-icons/react";
import CourseThumb from "@/components/CourseThumb";
import Rating from "@/components/Rating";
import CourseCard from "@/components/CourseCard";
import EmptyState from "@/components/EmptyState";
import PageLoader from "@/components/PageLoader";
import { useCatalog } from "@/context/CatalogContext";
import { api } from "@/lib/api";
import { useEnrollment } from "@/context/EnrollmentContext";
import { useCourseDetail } from "@/hooks/useCourseDetail";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import UserAvatar from "@/components/UserAvatar";
import { gsap, useGSAP } from "@/utils/gsap";

function ratingBreakdown(rating: number): number[] {
  const clamped = Math.min(5, Math.max(1, rating));
  const decay = 0.35 + (5 - clamped) * 0.25;
  const weights = [1, decay, decay ** 2, decay ** 3, decay ** 4];
  const total = weights.reduce((s, w) => s + w, 0);
  return weights.map((w) => Math.round((w / total) * 100));
}

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

export default function CourseDetails() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { course, loading } = useCourseDetail(id);
  const { courses } = useCatalog();
  const router = useRouter();
  const { user } = useAuth();
  const { isEnrolled, toggleSaved, enrollFree, enrollments } = useEnrollment();
  const { push } = useToast();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [enrolling, setEnrolling] = useState(false);
  // Latest QR payment for a paid course ("PENDING" = waiting for an admin to verify it).
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const paidCourse = !!course && course.discountPrice > 0;
  const enrolledHere = !!course && isEnrolled(course.id);

  useEffect(() => {
    if (!user || user.role !== "STUDENT" || !paidCourse || enrolledHere) return;
    let alive = true;
    api<{ results: { status: string }[] }>(`/payments/?course=${encodeURIComponent(id)}`)
      .then((page) => alive && setPaymentStatus(page.results[0]?.status ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user, id, paidCourse, enrolledHere]);

  const related = useMemo(() => {
    if (!course) return [];
    const same = courses.filter((c) => c.category === course.category && c.id !== course.id);
    const rest = courses
      .filter((c) => c.category !== course.category && c.id !== course.id)
      .sort((a, b) => b.rating - a.rating);
    return [...same, ...rest].slice(0, 4);
  }, [course, courses]);

  useGSAP(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(".cd-art", { scale: 1.15 }, {
        scale: 1, ease: "none",
        scrollTrigger: { trigger: ".cd-band", start: "top top", end: "bottom top", scrub: 0.8 },
      });
      gsap.to(".cd-art-wrap", {
        opacity: 0.25, ease: "none",
        scrollTrigger: { trigger: ".cd-band", start: "center 60%", end: "bottom top", scrub: 0.8 },
      });
    }, rootRef);
    return () => ctx.revert();
  }, { scope: rootRef, dependencies: [course?.id] }); // re-run once the course has loaded

  if (loading) return <PageLoader />;

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
  const oddOutcomes = course.whatYouLearn.length % 2 === 1;

  const isFree = course.discountPrice === 0;
  const underReview = !enrolled && paymentStatus === "PENDING";
  const ctaLabel = enrolled ? "Go to course" : isFree ? "Start learning for free" : underReview ? "Payment under review" : "Enroll now";

  const handleEnroll = async () => {
    // Free courses are open to everyone: visitors go straight to the lessons.
    if (isFree && !enrolled && (!user || user.role !== "STUDENT")) {
      router.push(`/learn/${course.id}`);
      return;
    }
    if (!user) {
      push("Please log in to enroll in this course.", "info");
      router.push(`/login?from=${encodeURIComponent(`/courses/${course.id}`)}`);
      return;
    }
    if (enrolled) {
      router.push(`/learn/${course.id}`);
      return;
    }
    if (course.discountPrice > 0) {
      router.push(`/checkout/${course.id}`);
      return;
    }
    // Free course: enroll straight away, no checkout.
    if (enrolling) return;
    setEnrolling(true);
    const res = await enrollFree(course.id);
    setEnrolling(false);
    if (!res.ok) {
      push(res.error, "error");
      return;
    }
    push("You're enrolled!", "success");
    router.push(`/learn/${course.id}`);
  };

  const handleSave = async () => {
    if (!user) {
      push("Log in to save courses to your list.", "info");
      return;
    }
    try {
      await toggleSaved(course.id);
      push(saved ? "Removed from saved courses" : "Saved to your list", "success");
    } catch {
      push("Couldn't update your saved courses. Please try again.", "error");
    }
  };

  return (
    <main ref={rootRef} className="overflow-x-hidden w-full max-w-full">

      {/* ATTENTION — Cinematic band: full-bleed art, dark wash, max-w-6xl title */}
      <section className="cd-band relative px-8 lg:px-16 pt-40 pb-56 bg-ink-strong overflow-hidden">
        <div className="cd-art-wrap absolute inset-0 overflow-hidden">
          <img
            src={`https://picsum.photos/seed/course${course.id}/1920/900`}
            alt=""
            aria-hidden="true"
            className="cd-art w-full h-full object-cover grayscale contrast-125 opacity-90"
          />
          <div className="absolute inset-0 aw-dark-wash" />
        </div>

        <div className="max-w-[1280px] mx-auto w-full relative">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50 mb-8">
              <Link href="/courses" className="hover:text-gold transition-colors">Courses</Link>
              <CaretRight size={11} />
              <Link href={`/categories/${course.category}`} className="hover:text-gold transition-colors">{course.category.replace("-", " ")}</Link>
              <CaretRight size={11} />
              <span className="text-white/80">{course.level}</span>
            </nav>

            <h1 className="aw-hero-h1 font-display text-white w-full max-w-6xl" style={{ fontSize: "clamp(2.4rem,4.5vw,4.2rem)" }}>
              {course.title}
            </h1>
            <p className="text-white/70 text-lg leading-relaxed max-w-[680px] mt-6">{course.description}</p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/75 mt-8">
              <Rating value={course.rating} count={course.students} light />
              <span className="flex items-center gap-1.5"><Users size={15} /> {course.students.toLocaleString()} students</span>
              <span className="flex items-center gap-1.5"><Clock size={15} /> {course.duration}</span>
              <span className="flex items-center gap-1.5"><ChartBar size={15} /> {course.level}</span>
              <span className="flex items-center gap-1.5"><Globe size={15} /> {course.language}</span>
            </div>

            <p className="text-sm text-white/60 mt-6">
              Created by <strong className="text-white">{course.instructor.name}</strong>, {course.instructor.title}
            </p>
          </motion.div>
        </div>
      </section>

      {/* INTEREST — Editorial body with overlapping commerce rail */}
      <section className="px-8 lg:px-16 pb-32 md:pb-48 bg-bg-soft">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-12 lg:gap-16 items-start">

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="flex flex-col gap-20 pt-16 lg:pt-20"
          >
            {/* Outcomes — gapless bento: 2 cols, odd last item spans 2 */}
            <motion.div variants={fadeUp}>
              <h2 className="font-display text-2xl md:text-4xl tracking-tighter font-semibold text-ink-strong mb-8">
                What you&apos;ll
                <span className="aw-inline-pill mx-2" style={{ backgroundImage: `url(https://picsum.photos/seed/${course.id}win/400/200)` }} aria-hidden="true" />
                learn
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 grid-flow-dense">
                {course.whatYouLearn.map((item, i) => (
                  <li
                    key={item}
                    className={`group flex items-start gap-3 p-5 bg-white border border-line rounded-2xl hover:border-gold hover:shadow-[0_8px_32px_rgba(255,182,6,0.1)] hover:-translate-y-0.5 transition-all duration-300 text-sm text-ink ${oddOutcomes && i === course.whatYouLearn.length - 1 ? "sm:col-span-2" : ""}`}
                  >
                    <CheckCircle size={18} weight="fill" className="text-gold-dark mt-0.5 flex-shrink-0 transition-transform duration-500 group-hover:scale-110" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Curriculum */}
            <motion.div variants={fadeUp}>
              <h2 className="font-display text-2xl md:text-4xl tracking-tighter font-semibold text-ink-strong mb-3">Course curriculum</h2>
              <p className="text-sm text-ink-muted mb-8">{course.curriculum.length} sections &middot; {totalLessons} lessons &middot; {course.duration} total</p>
              <div className="flex flex-col gap-3">
                {course.curriculum.map((section, index) => {
                  const open = openSections[section.id] ?? index === 0;
                  return (
                  <div key={section.id} className="border-2 border-line rounded-2xl bg-white overflow-hidden hover:border-gold transition-colors duration-300">
                    <button
                      className="w-full flex items-center justify-between gap-4 px-6 py-4 bg-transparent border-none cursor-pointer text-left font-semibold text-ink-strong hover:bg-gold-soft/50 transition-colors"
                      onClick={() => setOpenSections((s) => ({ ...s, [section.id]: !open }))}
                      aria-expanded={open}
                    >
                      <span>{section.title}</span>
                      <span className="flex items-center gap-3 text-xs font-normal text-ink-muted">
                        {section.lessons.length} lessons
                        <CaretDown size={14} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    <AnimatePresence>
                      {open && (
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
                  );
                })}
              </div>
            </motion.div>

            {/* Requirements + Description */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div>
                <h2 className="font-display text-2xl tracking-tighter font-semibold text-ink-strong mb-6">Requirements</h2>
                <ul className="flex flex-col gap-3">
                  {course.requirements.map((r) => (
                    <li key={r} className="flex items-start gap-3 text-sm text-ink">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold-dark mt-2 flex-shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="font-display text-2xl tracking-tighter font-semibold text-ink-strong mb-6">Description</h2>
                <p className="text-sm text-ink-muted leading-relaxed">{course.description}</p>
                <p className="text-sm text-ink-muted leading-relaxed mt-4">
                  Built for students, working professionals, and lifelong learners in Bhutan who want practical,
                  job-ready {course.category.replace("-", " ")} skills, no matter their starting point.
                </p>
              </div>
            </motion.div>

            {/* Reviews */}
            <motion.div variants={fadeUp}>
              <h2 className="font-display text-2xl md:text-4xl tracking-tighter font-semibold text-ink-strong mb-8">Student reviews</h2>
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-6 mb-6">
                <div className="flex flex-col items-center justify-center py-8 bg-white border-2 border-line rounded-2xl">
                  <strong className="font-display text-5xl font-bold text-ink-strong">{course.rating.toFixed(1)}</strong>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { name: "Sonam Choki", text: "Very clear explanations and practical exercises. Helped me a lot with my studies.", rating: 5, color: "bg-ink-strong" },
                  { name: "Pema Tobgay", text: "Good pacing and the instructor explains concepts step by step.", rating: 4.5, color: "bg-gold-dark" },
                ].map((r) => (
                  <div key={r.name} className="group flex gap-4 p-6 bg-white border-2 border-line rounded-2xl hover:border-gold hover:-translate-y-0.5 transition-all duration-300">
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

          {/* COMMERCE RAIL — overlaps the band, sticks on scroll */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lg:sticky lg:top-28 lg:-mt-40"
          >
            <div className="group bg-white border-2 border-line rounded-3xl overflow-hidden shadow-elevated">
              <div className="overflow-hidden">
                <CourseThumb course={course} className="!rounded-none transition-transform duration-700 ease-out group-hover:scale-[1.02]" />
              </div>
              <div className="p-7">
                <div className="flex items-baseline gap-3 mb-5">
                  {course.discountPrice === 0 ? (
                    <strong className="font-display text-3xl font-bold text-emerald-700">Free</strong>
                  ) : (
                    <strong className="font-display text-3xl font-bold text-ink-strong">Nu. {course.discountPrice.toLocaleString()}</strong>
                  )}
                  {course.discountPrice > 0 && course.discountPrice < course.price && (
                    <>
                      <span className="text-sm text-ink-muted line-through">Nu. {course.price.toLocaleString()}</span>
                      <span className="bg-red-soft text-red text-[0.65rem] font-bold px-2 py-0.5 rounded-full">{Math.round((1 - course.discountPrice / course.price) * 100)}% off</span>
                    </>
                  )}
                </div>

                {enrolled ? (
                  <Link href={`/learn/${course.id}`} className="btn btn-primary btn-lg btn-block">
                    <PlayCircle size={17} /> Go to Course
                  </Link>
                ) : (
                  <button className="btn btn-primary btn-lg btn-block" onClick={handleEnroll} disabled={enrolling}>
                    {enrolling ? "Opening…" : ctaLabel}
                  </button>
                )}
                {underReview && (
                  <p className="text-xs text-ink-muted mt-3 text-center">
                    We received your payment details. You&apos;ll get a notification once an admin verifies them.
                  </p>
                )}
                {!enrolled && !isFree && !underReview && (
                  <p className="text-xs text-ink-muted mt-3 text-center">Pay by scanning our bank QR code with mBoB or any Bhutanese bank app.</p>
                )}

                <button
                  className="flex items-center justify-center gap-2 w-full mt-4 bg-transparent border-none text-sm font-bold text-gold-dark hover:text-gold transition-colors cursor-pointer"
                  onClick={handleSave}
                  aria-pressed={saved}
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

      {/* DESIRE — Instructor strip */}
      <section className="px-8 lg:px-16 pb-32 md:pb-48 bg-bg-soft">
        <div className="max-w-[1280px] mx-auto">
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 p-10 md:p-12 bg-ink-strong rounded-3xl overflow-hidden aw-grain">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_20%,rgba(255,182,6,0.22)_0%,transparent_55%)]" />
            <UserAvatar
              name={course.instructor.name}
              src={course.instructor.avatar}
              color="#ffb606"
              textColor="text-ink-strong"
              className="relative w-16 h-16 font-display text-2xl"
            />
            <div className="relative flex-1">
              <h2 className="font-display text-xl md:text-2xl font-semibold text-white">Learn from {course.instructor.name}</h2>
              <p className="text-sm text-white/60 mt-1">{course.instructor.title} — teaching {course.category.replace("-", " ")} for real outcomes.</p>
            </div>
            {!enrolled && (
              <button className="btn btn-primary btn-lg relative flex-shrink-0" onClick={handleEnroll}>
                {ctaLabel} <ArrowRight size={14} weight="bold" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ACTION — Gapless related row: always exactly 4 */}
      {related.length > 0 && (
        <section className="py-32 md:py-48 px-8 lg:px-16 bg-white">
          <div className="max-w-[1280px] mx-auto">
            <motion.h2
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
              variants={fadeUp} transition={{ duration: 0.6 }}
              className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong mb-16 md:mb-20 max-w-[640px]"
            >
              Keep exploring
            </motion.h2>
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
              variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 grid-flow-dense"
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