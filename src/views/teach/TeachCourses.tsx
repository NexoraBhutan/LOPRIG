"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Book, Plus, Users, Clock } from "@phosphor-icons/react";
import PageLoader from "@/components/PageLoader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/teach/StatusBadge";
import { api, errorMessage } from "@/lib/api";
import { STATUS_META, formatMoney, type CourseStatus, type TeachCourse } from "@/lib/teach";

const FILTERS: ("ALL" | CourseStatus)[] = ["ALL", "DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED"];
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

export default function TeachCourses() {
  const [courses, setCourses] = useState<TeachCourse[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");

  useEffect(() => {
    api<TeachCourse[]>("/teach/courses/").then(setCourses).catch((err) => setError(errorMessage(err)));
  }, []);

  const shown = useMemo(
    () => (courses ?? []).filter((c) => filter === "ALL" || c.status === filter),
    [courses, filter]
  );

  if (error) return <EmptyState title="Couldn't load your courses" description={error} />;
  if (!courses) return <PageLoader />;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl tracking-tighter font-semibold text-ink-strong">My courses</h1>
          <p className="text-sm text-ink-muted mt-2">Create, edit and track every course you teach.</p>
        </div>
        <Link href="/teach/courses/new" className="btn btn-md btn-primary self-start"><Plus size={15} weight="bold" /> New course</Link>
      </div>

      {courses.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => {
            const count = f === "ALL" ? courses.length : courses.filter((c) => c.status === f).length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`px-4 py-2 rounded-full text-sm font-medium border-2 border-solid cursor-pointer transition-colors ${
                  filter === f ? "bg-ink-strong text-white border-ink-strong" : "bg-white text-ink border-line hover:border-gold"
                }`}
              >
                {f === "ALL" ? "All" : STATUS_META[f].label} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {courses.length === 0 ? (
        <div className="bg-white border-2 border-line rounded-2xl">
          <EmptyState pose="idle" title="No courses yet" description="Your first course is a few minutes away." ctaLabel="Create a course" ctaTo="/teach/courses/new" />
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-ink-muted bg-white border-2 border-line rounded-2xl p-6">No courses with this status.</p>
      ) : (
        <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {shown.map((c) => (
            <motion.div key={c.id} variants={fadeUp}>
              <Link href={`/teach/courses/${c.id}`} className="group flex flex-col h-full bg-white border-2 border-line rounded-2xl overflow-hidden no-underline hover:border-gold hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(255,182,6,0.12)] transition-all duration-300">
                <div className="relative flex items-center justify-center aspect-[16/8]" style={{ background: `linear-gradient(135deg, ${c.gradient_start}, ${c.gradient_end})` }}>
                  <Book size={36} weight="duotone" className="text-white/30" />
                  <span className="absolute top-3 left-3 rounded-full bg-white/95"><StatusBadge status={c.status} /></span>
                </div>
                <div className="flex flex-col flex-1 p-5">
                  <h2 className="text-base font-semibold text-ink-strong leading-snug line-clamp-2 group-hover:text-gold-dark transition-colors">{c.title}</h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1.5"><Clock size={13} /> {c.lessons_count} lessons · {c.duration}</span>
                    <span className="inline-flex items-center gap-1.5"><Users size={13} /> {c.enrolled} enrolled</span>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-4">
                    <strong className="text-sm text-ink-strong">{c.price ? formatMoney(c.discount_price ?? c.price) : "Free"}</strong>
                    <span className="text-xs font-bold uppercase tracking-widest text-gold-dark">Edit</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
