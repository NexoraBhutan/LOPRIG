"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users, BookOpen, Hourglass, Coins, Plus, CaretRight, WarningCircle, ArrowRight, Exam,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { CoverArt } from "@/components/CourseThumb";
import PageLoader from "@/components/PageLoader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/teach/StatusBadge";
import { api, errorMessage } from "@/lib/api";
import { formatMoney, timeAgo, type TeachCourse, type TeachSummary } from "@/lib/teach";

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

export default function TeachDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TeachSummary | null>(null);
  const [courses, setCourses] = useState<TeachCourse[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<TeachSummary>("/teach/summary/"), api<TeachCourse[]>("/teach/courses/")])
      .then(([s, c]) => { setSummary(s); setCourses(c); })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <EmptyState title="Couldn't load your dashboard" description={error} ctaLabel="Try again" ctaOnClick={() => location.reload()} />;
  if (!summary) return <PageLoader />;

  const needsChanges = courses.filter((c) => c.status === "REJECTED");
  const stats = [
    { label: "Students enrolled", value: summary.students.toLocaleString(), icon: Users },
    { label: "Published courses", value: summary.courses.PUBLISHED, icon: BookOpen },
    { label: "In review", value: summary.courses.PENDING_REVIEW, icon: Hourglass },
    { label: "Earnings", value: formatMoney(summary.revenue), icon: Coins },
  ];

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="flex flex-col gap-8">
      <motion.section
        variants={fadeUp}
        className="relative overflow-hidden rounded-2xl bg-ink-strong text-white px-7 py-9 md:px-10 md:py-11 flex flex-col md:flex-row md:items-end md:justify-between gap-6"
      >
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_0%,rgba(255,182,6,0.28)_0%,transparent_55%)]" />
        <div className="relative">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-gold mb-3">Teacher portal</p>
          <h1 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold leading-tight text-white">
            Welcome back, {user?.name.split(" ")[0]}
          </h1>
          <p className="text-white/65 mt-3 max-w-[520px]">
            {summary.students
              ? `${summary.students.toLocaleString()} student${summary.students === 1 ? " is" : "s are"} learning from you on Lop-rig.`
              : "Build your first lessons and share what you know with learners across Bhutan."}
          </p>
        </div>
        <Link href="/teach/courses/new" className="relative btn btn-primary btn-lg self-start md:self-auto">
          <Plus size={16} weight="bold" /> New course
        </Link>
      </motion.section>

      {summary.pending_reviews > 0 && (
        <motion.div variants={fadeUp}>
          <Link
            href="/teach/reviews"
            className="flex items-center gap-4 p-5 rounded-2xl border-2 border-gold bg-gold-soft text-ink-strong no-underline hover:border-gold-dark transition-colors"
          >
            <Exam size={24} weight="duotone" className="text-gold-dark flex-shrink-0" />
            <span className="flex-1 text-sm">
              <strong className="font-semibold">
                {summary.pending_reviews === 1 ? "1 student is" : `${summary.pending_reviews} students are`} waiting for you to mark their answers
              </strong>
              <span className="block text-ink-muted">They can&apos;t finish the chapter until you review their written answers.</span>
            </span>
            <ArrowRight size={16} weight="bold" className="text-gold-dark" />
          </Link>
        </motion.div>
      )}

      {needsChanges.length > 0 && (
        <motion.div variants={fadeUp}>
          <Link
            href={`/teach/courses/${needsChanges[0].id}`}
            className="flex items-center gap-4 p-5 rounded-2xl border-2 border-red/30 bg-red-soft text-ink-strong no-underline hover:border-red transition-colors"
          >
            <WarningCircle size={24} weight="fill" className="text-red-dark flex-shrink-0" />
            <span className="flex-1 text-sm">
              <strong className="font-semibold">
                {needsChanges.length === 1 ? `“${needsChanges[0].title}” needs changes` : `${needsChanges.length} courses need changes`}
              </strong>
              <span className="block text-ink-muted">Read the reviewer&apos;s note, update the course and submit it again.</span>
            </span>
            <ArrowRight size={16} weight="bold" className="text-red-dark" />
          </Link>
        </motion.div>
      )}

      <motion.div variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <motion.div key={label} variants={fadeUp} className="bg-white border-2 border-line rounded-2xl p-5 hover:border-gold transition-colors">
            <span className="w-10 h-10 rounded-xl bg-gold-soft text-gold-dark flex items-center justify-center mb-4">
              <Icon size={20} weight="duotone" />
            </span>
            <strong className="block font-display text-2xl md:text-3xl font-semibold text-ink-strong tracking-tight">{value}</strong>
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</span>
          </motion.div>
        ))}
      </motion.div>

      {courses.length === 0 ? (
        <motion.section variants={fadeUp} className="bg-white border-2 border-line rounded-2xl">
          <EmptyState
            pose="idle"
            title="Create your first course"
            description="Add a title and description, build your lessons, then send it to the Lop-rig team for review."
            ctaLabel="Start a course"
            ctaTo="/teach/courses/new"
          />
        </motion.section>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-6">
          <motion.section variants={fadeUp} className="bg-white border-2 border-line rounded-2xl p-6">
            <div className="flex items-end justify-between mb-5">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink-strong">Your courses</h2>
                <p className="text-sm text-ink-muted">{summary.courses.total} total</p>
              </div>
              <Link href="/teach/courses" className="text-xs font-bold uppercase tracking-widest text-gold-dark hover:text-gold no-underline">View all</Link>
            </div>
            <ul className="divide-y divide-line">
              {courses.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link href={`/teach/courses/${c.id}`} className="group flex items-center gap-4 py-3.5 no-underline">
                    <CoverArt src={c.thumbnail_url} gradient={[c.gradient_start, c.gradient_end]} iconSize={0} className="w-14 h-10 rounded-lg flex-shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-ink-strong truncate group-hover:text-gold-dark transition-colors">{c.title}</span>
                      <span className="block text-xs text-ink-muted">{c.lessons_count} lessons · {c.enrolled} enrolled</span>
                    </span>
                    <StatusBadge status={c.status} className="hidden sm:inline-flex" />
                    <CaretRight size={14} className="text-ink-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.section>

          <motion.section variants={fadeUp} className="bg-white border-2 border-line rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold text-ink-strong">Recent enrollments</h2>
            <p className="text-sm text-ink-muted mb-5">{summary.completions} course completion{summary.completions === 1 ? "" : "s"} so far</p>
            {summary.recent_enrollments.length ? (
              <ul className="flex flex-col gap-4">
                {summary.recent_enrollments.map((e, i) => (
                  <li key={`${e.course_id}-${i}`} className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-gold-soft text-gold-dark font-bold text-sm flex items-center justify-center flex-shrink-0" aria-hidden="true">
                      {e.student.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-ink-strong truncate">{e.student}</span>
                      <span className="block text-xs text-ink-muted truncate">{e.course}</span>
                    </span>
                    <span className="text-xs text-ink-muted whitespace-nowrap">{timeAgo(e.enrolled_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted bg-bg-soft rounded-xl p-4">No students yet. They&apos;ll appear here once your course is published.</p>
            )}
          </motion.section>
        </div>
      )}
    </motion.div>
  );
}
