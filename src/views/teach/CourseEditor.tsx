"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, PaperPlaneTilt, ArrowSquareOut, WarningCircle, Hourglass, CheckCircle, Circle, Trash,
} from "@phosphor-icons/react";
import { useToast } from "@/context/ToastContext";
import { useCatalog } from "@/context/CatalogContext";
import PageLoader from "@/components/PageLoader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/teach/StatusBadge";
import CourseForm from "@/components/teach/CourseForm";
import CurriculumBuilder from "@/components/teach/CurriculumBuilder";
import StudentsTable from "@/components/teach/StudentsTable";
import { ApiError, api, errorMessage } from "@/lib/api";
import { formatMoney, type TeachCourse } from "@/lib/teach";

const TABS = [
  { id: "curriculum", label: "Curriculum" },
  { id: "details", label: "Details" },
  { id: "students", label: "Students" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const CHECKLIST: [string, string][] = [
  ["description", "Description of 30+ characters"],
  ["outcome", "At least one learning outcome"],
  ["lesson", "At least one lesson"],
];

export default function CourseEditor() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const { push } = useToast();
  const { reload: reloadCatalog } = useCatalog();
  const [course, setCourse] = useState<TeachCourse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);
  const tab: Tab = TABS.find((t) => t.id === searchParams?.get("tab"))?.id ?? "curriculum";

  const fetchCourse = useCallback(() => api<TeachCourse>(`/teach/courses/${encodeURIComponent(id)}/`), [id]);

  useEffect(() => {
    let cancelled = false;
    fetchCourse()
      .then((c) => { if (!cancelled) { setCourse(c); setState("ready"); } })
      .catch((err) => !cancelled && setState(err instanceof ApiError && err.status === 404 ? "missing" : "error"));
    return () => {
      cancelled = true;
    };
  }, [fetchCourse]);

  /** Re-fetch after the curriculum changes. */
  const load = useCallback(async () => {
    setCourse(await fetchCourse());
  }, [fetchCourse]);

  if (state === "loading") return <PageLoader />;
  if (state !== "ready" || !course) {
    return (
      <EmptyState
        title={state === "missing" ? "Course not found" : "Couldn't load this course"}
        description={state === "missing" ? "It may have been deleted, or it belongs to another teacher." : "Check your connection and try again."}
        ctaLabel="Back to my courses"
        ctaTo="/teach/courses"
      />
    );
  }

  const canSubmit = course.status === "DRAFT" || course.status === "REJECTED";
  const problems = course.review_problems ?? [];

  const submit = async () => {
    setSubmitting(true);
    try {
      setCourse(await api<TeachCourse>(`/teach/courses/${course.id}/submit/`, { method: "POST" }));
      push("Submitted! The Lop-rig team will review your course.", "success");
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${course.title}”? This can't be undone.`)) return;
    try {
      await api(`/teach/courses/${course.id}/`, { method: "DELETE" });
      push("Course deleted", "success");
      router.push("/teach/courses");
    } catch (err) {
      push(errorMessage(err), "error");
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <div>
        <Link href="/teach/courses" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink-muted hover:text-ink-strong no-underline mb-5">
          <ArrowLeft size={14} weight="bold" /> My courses
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div className="min-w-0">
            <StatusBadge status={course.status} />
            <h1 className="font-display text-3xl md:text-4xl tracking-tighter font-semibold text-ink-strong mt-3 leading-tight">{course.title}</h1>
            <p className="text-sm text-ink-muted mt-2">
              {course.lessons_count} lessons · {course.duration} · {course.enrolled} enrolled · {course.price ? formatMoney(course.discount_price ?? course.price) : "Free"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {course.status === "PUBLISHED" && (
              <Link href={`/courses/${course.id}`} target="_blank" className="btn btn-md btn-outline-neutral">
                <ArrowSquareOut size={15} weight="bold" /> View on site
              </Link>
            )}
            {canSubmit && (
              <button onClick={submit} disabled={submitting || problems.length > 0} className="btn btn-md btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                <PaperPlaneTilt size={15} weight="bold" /> {submitting ? "Submitting…" : "Submit for review"}
              </button>
            )}
          </div>
        </div>
      </div>

      {course.status === "REJECTED" && (
        <div role="status" className="flex gap-4 p-5 rounded-2xl border-2 border-red/30 bg-red-soft">
          <WarningCircle size={24} weight="fill" className="text-red-dark flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-ink-strong">The reviewer asked for changes</p>
            <p className="text-ink mt-1 whitespace-pre-line">{course.review_note}</p>
          </div>
        </div>
      )}
      {course.status === "PENDING_REVIEW" && (
        <div role="status" className="flex gap-4 p-5 rounded-2xl border-2 border-gold/40 bg-gold-soft">
          <Hourglass size={24} weight="fill" className="text-gold-dark flex-shrink-0" />
          <p className="text-sm text-ink"><strong className="text-ink-strong">In review.</strong> The Lop-rig team is checking your course. You&apos;ll get a notification when it&apos;s published or if changes are needed.</p>
        </div>
      )}
      {canSubmit && (
        <div className="bg-white border-2 border-line rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-strong mb-3">Ready for review?</p>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {CHECKLIST.map(([key, label]) => {
              const done = !problems.some((p) => p.toLowerCase().includes(key));
              return (
                <li key={key} className={`flex items-center gap-2 ${done ? "text-ink" : "text-ink-muted"}`}>
                  {done ? <CheckCircle size={18} weight="fill" className="text-emerald-600" /> : <Circle size={18} />}
                  {label}
                </li>
              );
            })}
          </ul>
          {/* Anything the checklist doesn't cover, e.g. a video still processing or a failed upload. */}
          {problems.filter((p) => !CHECKLIST.some(([key]) => p.toLowerCase().includes(key))).map((p) => (
            <p key={p} className="flex items-center gap-2 mt-3 text-sm text-amber-800">
              <WarningCircle size={18} weight="fill" className="text-amber-500 flex-shrink-0" /> {p}
            </p>
          ))}
        </div>
      )}

      <nav role="tablist" aria-label="Course sections" className="flex gap-1 border-b border-line overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            href={`/teach/courses/${course.id}?tab=${t.id}`}
            scroll={false}
            className={`px-5 py-3 -mb-px text-sm font-bold border-b-2 no-underline whitespace-nowrap transition-colors ${
              tab === t.id ? "border-gold text-gold-dark" : "border-transparent text-ink-muted hover:text-ink-strong"
            }`}
          >
            {t.label}
            {t.id === "students" && <span className="ml-2 text-xs font-semibold text-ink-muted">{course.enrolled}</span>}
          </Link>
        ))}
      </nav>

      <div role="tabpanel">
        {tab === "curriculum" && <CurriculumBuilder course={course} onChange={load} />}
        {tab === "details" && (
          <div className="flex flex-col gap-8">
            <CourseForm
              key={course.updated_at}
              course={course}
              onSaved={(saved) => {
                setCourse(saved);
                if (saved.status === "PUBLISHED") reloadCatalog();
                push("Course details saved", "success");
              }}
            />
            {canSubmit && course.enrolled === 0 && (
              <section className="border-2 border-red/30 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-ink-strong">Delete this course</h2>
                  <p className="text-sm text-ink-muted">Only unpublished courses without students can be deleted.</p>
                </div>
                <button onClick={remove} className="btn btn-md btn-danger self-start"><Trash size={15} weight="bold" /> Delete course</button>
              </section>
            )}
          </div>
        )}
        {tab === "students" && <StudentsTable courseId={course.id} />}
      </div>
    </div>
  );
}
