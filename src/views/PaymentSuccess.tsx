"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle, Star, ArrowRight, PlayCircle } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { useEnrollment } from "@/context/EnrollmentContext";
import { useCourseDetail } from "@/hooks/useCourseDetail";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

export default function PaymentSuccess() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const { user } = useAuth();
  const { enrollments } = useEnrollment();

  // Last path segment is the course id.
  const courseId = pathname.split("/").pop() || "";
  const { course } = useCourseDetail(courseId);
  const enrollment = enrollments[courseId];

  const nextLesson = course?.curriculum.flatMap((s) => s.lessons)[0];
  const enrolled = Boolean(enrollment?.enrolledAt);

  const handleStart = () => {
    if (!user) {
      router.push(`/login?from=${encodeURIComponent(`/payment-success/${courseId}`)}`);
      return;
    }
    if (!enrolled) {
      router.push(`/checkout/${courseId}`);
      return;
    }
    router.push(`/learn/${courseId}`);
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full px-8 lg:px-16 pt-36 pb-32 md:pb-48 aw-gold-wash min-h-[100dvh] flex items-center">
      <div className="max-w-[1280px] mx-auto w-full">

        <motion.div
          initial="hidden" animate="visible"
          variants={stagger}
          className="bg-white border-2 border-line rounded-2xl p-10 md:p-14 max-w-[760px] mx-auto text-center"
        >
          <motion.div variants={fadeUp} className="flex items-center justify-center gap-2 mb-8">
            <span className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-bold px-4 py-2 rounded-full">
              <CheckCircle size={14} weight="fill" /> Payment confirmed
            </span>
          </motion.div>

          <motion.h1 variants={fadeUp} className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong leading-tight">
            You&apos;re enrolled
          </motion.h1>

          <motion.p variants={fadeUp} className="text-ink-muted text-lg mt-4 max-w-[520px] mx-auto leading-relaxed">
            Thank you for your purchase. Your course is unlocked and ready — start learning whenever you are.
          </motion.p>

          {course && (
            <motion.div variants={fadeUp} className="mt-8">
              <img
                src={`https://picsum.photos/seed/success${course.id}/1600/900`}
                alt=""
                aria-hidden="true"
                className="rounded-xl w-full aspect-video object-cover"
              />
            </motion.div>
          )}

          {course && (
            <motion.div variants={fadeUp} className="mt-8 text-left">
              <span className="text-[0.7rem] font-bold text-gold-dark uppercase tracking-widest">
                {course.category.replace("-", " ")} · {course.level}
              </span>
              <h2 className="text-xl font-semibold text-ink-strong mt-2">{course.title}</h2>
              <p className="text-sm text-ink-muted mt-1">{course.instructor.name}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                {[
                  { label: "Lessons", value: String(course.curriculum.reduce((s, sec) => s + sec.lessons.length, 0)) },
                  { label: "Duration", value: course.duration },
                  { label: "Level", value: course.level },
                  { label: "Rating", value: `${course.rating.toFixed(1)} / 5` },
                ].map((stat) => (
                  <div key={stat.label} className="bg-bg-soft rounded-xl p-4 text-center">
                    <span className="block text-[0.65rem] font-bold text-ink-muted uppercase tracking-wider">{stat.label}</span>
                    <span className="block text-sm font-bold text-ink-strong mt-1">{stat.value}</span>
                  </div>
                ))}
              </div>

              {nextLesson && (
                <p className="text-sm text-ink-muted mt-6 flex items-center gap-2">
                  <Star size={13} weight="fill" className="text-gold-dark" />
                  Next up: <span className="font-semibold text-ink-strong">{nextLesson.title}</span>
                </p>
              )}
            </motion.div>
          )}

          <motion.div variants={fadeUp} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleStart}
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-gold text-ink-strong font-bold rounded-[4px] hover:bg-gold-dark transition-colors cursor-pointer border-none text-sm tracking-widest uppercase"
            >
              <PlayCircle size={15} weight="fill" /> {enrolled ? "Start learning" : "Go to checkout"}
            </button>
            <Link href="/dashboard" className="inline-flex items-center gap-2 px-7 py-3.5 bg-ink-strong text-white font-bold rounded-[4px] hover:bg-black transition-colors text-sm tracking-widest uppercase no-underline">
              Go to dashboard <ArrowRight size={14} weight="bold" />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}