"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PlayCircle, Bookmark, Fire, Diamond, Certificate, Hourglass, WarningCircle, ArrowRight } from "@phosphor-icons/react";
import { apiAll } from "@/lib/api";
import { useEnrollment } from "@/context/EnrollmentContext";
import { useCatalog } from "@/context/CatalogContext";
import CourseThumb from "@/components/CourseThumb";
import ProgressBar from "@/components/ProgressBar";
import ProgressRing from "@/components/ProgressRing";
import EmptyState from "@/components/EmptyState";
import { gsap, useGSAP } from "@/utils/gsap";

const TABS = ["All", "In Progress", "Completed", "Saved"] as const;
type Tab = (typeof TABS)[number];

interface MyPayment {
  reference: string;
  course: string;
  course_title: string;
  provider: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  failure_reason: string;
  created_at: string;
}

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

export default function MyLearning() {
  const { enrolledCourses, savedCourses, isEnrolled, getProgress, streak, xp } = useEnrollment();
  const { getCourse } = useCatalog();
  const [tab, setTab] = useState<Tab>("All");
  // course slug -> certificate code, for "View certificate" on finished courses.
  const [certificates, setCertificates] = useState<Record<string, string>>({});
  // Each course's latest payment: paid courses waiting to be unlocked, or payments sent back.
  const [payments, setPayments] = useState<MyPayment[]>([]);

  useEffect(() => {
    let alive = true;
    apiAll<{ code: string; course: string }>("/certificates/")
      .then((list) => alive && setCertificates(Object.fromEntries(list.map((c) => [c.course, c.code]))))
      .catch(() => undefined); // the cards still work without it
    apiAll<MyPayment>("/payments/")
      .then((list) => {
        if (!alive) return;
        const latest = new Map<string, MyPayment>();
        for (const p of list) {
          const seen = latest.get(p.course);
          if (!seen || p.created_at > seen.created_at) latest.set(p.course, p);
        }
        setPayments([...latest.values()]);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const rootRef = useRef<HTMLElement>(null);

  const waiting = useMemo(
    () => payments
      .filter((p) => p.status === "PENDING" && !isEnrolled(p.course))
      .flatMap((p) => {
        const course = getCourse(p.course);
        return course ? [{ course, progress: 0, payment: p as MyPayment | null }] : [];
      }),
    [payments, isEnrolled, getCourse],
  );

  const items = useMemo(() => {
    const withProgress = enrolledCourses.map((c) => ({ course: c, progress: getProgress(c.id), payment: null as MyPayment | null }));
    if (tab === "In Progress") return [...waiting, ...withProgress.filter((x) => x.progress < 100)];
    if (tab === "Completed") return withProgress.filter((x) => x.progress === 100);
    if (tab === "Saved") return savedCourses.map((c) => ({ course: c, progress: getProgress(c.id), payment: null as MyPayment | null }));
    return [...waiting, ...withProgress];
  }, [tab, enrolledCourses, savedCourses, getProgress, waiting]);

  // Enrollments come most recently studied first, so this is the course they were last on.
  const continueCourse = useMemo(() => {
    const list = enrolledCourses.map((c) => ({ course: c, progress: getProgress(c.id) }));
    return list.find((c) => c.progress < 100) || list[0];
  }, [enrolledCourses, getProgress]);

  const paymentNotices = payments.filter((p) => !isEnrolled(p.course) && p.status === "FAILED");

  useGSAP(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".ml-card").forEach((card) => {
        gsap.fromTo(card, { y: 40, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.55, ease: "power2.out",
          scrollTrigger: { trigger: card, start: "top 92%", toggleActions: "play none none reverse" },
        });
      });
    }, rootRef);
    return () => ctx.revert();
  }, { scope: rootRef, dependencies: [items.length, tab] });

  return (
    <main ref={rootRef} className="overflow-x-hidden w-full max-w-full px-5 sm:px-8 lg:px-16 pt-36 pb-32 md:pb-48 aw-gold-wash">
      <div className="max-w-[1280px] mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14"
        >
          <div>
            <h1 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong">My Learning</h1>
            <p className="text-ink-muted text-lg mt-3">Your enrolled courses, all in one place.</p>
          </div>
          <div className="flex gap-3">
            <span className="inline-flex items-center gap-2 bg-gold-soft text-gold-dark text-xs font-bold px-4 py-2 rounded-full">
              <Fire size={15} weight="fill" /> {streak}-day streak
            </span>
            <span className="inline-flex items-center gap-2 bg-ink-strong text-white text-xs font-bold px-4 py-2 rounded-full">
              <Diamond size={14} weight="fill" /> {xp} XP
            </span>
          </div>
        </motion.div>

        {/* Payments that were sent back */}
        {paymentNotices.length > 0 && (
          <ul className="flex flex-col gap-3 mb-10 list-none p-0">
            {paymentNotices.map((p) => (
              <li key={p.reference}>
                {(
                  <Link href={`/checkout/${p.course}`} className="group flex items-start gap-4 p-5 rounded-2xl border-2 border-red/30 bg-red-soft no-underline hover:border-red transition-colors">
                    <WarningCircle size={24} weight="fill" className="text-red-dark flex-shrink-0" />
                    <span className="flex-1 text-sm text-ink">
                      <strong className="block text-ink-strong">Your payment for “{p.course_title}” wasn&apos;t accepted</strong>
                      {p.failure_reason || "Please check the details and send it again."}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-red-dark whitespace-nowrap">
                      Try again <ArrowRight size={13} weight="bold" />
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Continue hero */}
        {continueCourse && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="group grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-0 bg-white border-2 border-line rounded-2xl overflow-hidden hover:border-gold hover:shadow-elevated transition-all duration-300 mb-14"
          >
            <div className="overflow-hidden min-h-[220px]">
              <CourseThumb course={continueCourse.course} className="!aspect-auto !min-h-[220px] !h-full transition-transform duration-700 ease-out group-hover:scale-[1.02]" />
            </div>
            <div className="p-8 flex flex-col justify-center gap-5">
              <div className="flex items-center justify-between gap-6">
                <span className="text-[0.7rem] font-bold text-gold-dark uppercase tracking-wider">Continue where you left off</span>
                <ProgressRing value={continueCourse.progress} size={64} tone="brand" label={`${continueCourse.progress}% of ${continueCourse.course.title} complete`} />
              </div>
              <h2 className="text-xl font-semibold leading-snug">{continueCourse.course.title}</h2>
              <p className="text-sm text-ink-muted">{continueCourse.course.instructor.name} &middot; {continueCourse.course.duration}</p>
              <Link href={`/learn/${continueCourse.course.id}`} className="btn btn-primary self-start">
                <PlayCircle size={15} /> {continueCourse.progress > 0 ? "Continue Lesson" : "Start Learning"}
              </Link>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-10 border-b border-line overflow-x-auto" role="tablist" aria-label="Course filters">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-5 py-3.5 text-sm font-bold whitespace-nowrap border-b-2 transition-colors bg-transparent cursor-pointer -mb-px ${
                tab === t ? "border-gold text-gold-dark" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Course list */}
        {items.length ? (
          <motion.div
            key={tab}
            initial="hidden" animate="visible"
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {items.map(({ course, progress, payment }) => {
              const enrolled = isEnrolled(course.id);
              return (
                <motion.div key={course.id} variants={fadeUp} className="ml-card group bg-white border-2 border-line rounded-xl overflow-hidden hover:border-gold hover:shadow-elevated hover:-translate-y-1 transition-all duration-300">
                  <div className="relative overflow-hidden">
                    <CourseThumb course={course} />
                    {progress === 100 && (
                      <span className="absolute top-3 left-3 bg-emerald-500 text-white text-[0.65rem] font-bold px-3 py-1 rounded-[4px] tracking-wider uppercase">Completed</span>
                    )}
                    {payment && (
                      <span className="absolute top-3 left-3 bg-gold text-ink-strong text-[0.65rem] font-bold px-3 py-1 rounded-[4px] tracking-wider uppercase inline-flex items-center gap-1">
                        <Hourglass size={11} weight="fill" /> Payment received
                      </span>
                    )}
                    {!enrolled && !payment && (
                      <span className="absolute top-3 left-3 bg-white/90 text-ink-strong text-[0.65rem] font-bold px-3 py-1 rounded-[4px] tracking-wider uppercase inline-flex items-center gap-1">
                        <Bookmark size={11} weight="fill" /> Saved
                      </span>
                    )}
                  </div>
                  <div className="p-5 flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-ink-strong leading-snug line-clamp-2">{course.title}</h3>
                    <p className="text-xs text-ink-muted">{course.instructor.name}</p>
                    {payment ? (
                      <div className="flex flex-col gap-2 mt-1">
                        <p className="text-xs text-ink">
                          You&apos;ve paid for this course. We&apos;re unlocking it now and will email you the moment it&apos;s ready.
                        </p>
                        <span className="btn btn-sm btn-outline-neutral self-start opacity-70 cursor-default inline-flex items-center gap-1.5" aria-disabled="true">
                          <Hourglass size={14} /> Unlocking soon
                        </span>
                      </div>
                    ) : (
                    <ProgressBar value={progress} />
                    )}
                    {payment ? null : enrolled ? (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {certificates[course.id] ? (
                          <>
                            <Link href={`/certificates/${certificates[course.id]}`} className="btn btn-primary btn-sm">
                              <Certificate size={14} weight="fill" /> View certificate
                            </Link>
                            <Link href={`/learn/${course.id}`} className="btn btn-outline-neutral btn-sm">
                              <PlayCircle size={14} /> Review
                            </Link>
                          </>
                        ) : (
                          <Link href={`/learn/${course.id}`} className="btn btn-primary btn-sm">
                            <PlayCircle size={14} /> {progress > 0 ? "Continue" : "Start"}
                          </Link>
                        )}
                      </div>
                    ) : (
                      <Link href={`/courses/${course.id}`} className="btn btn-outline btn-sm self-start mt-1">View course</Link>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white border-2 border-line rounded-2xl">
            <EmptyState
              pose="sad"
              title={
                tab === "Saved" ? "No saved courses" :
                tab === "Completed" ? "No completed courses yet" :
                tab === "In Progress" ? "No courses in progress" :
                "No courses yet"
              }
              description="Browse the catalog and enroll in a course to start building skills."
              ctaLabel="Explore courses"
              ctaTo="/courses"
            />
          </motion.div>
        )}
      </div>
    </main>
  );
}