"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, CheckCircle, Circle, XCircle, VideoCamera, Article, PuzzlePiece, Eye, ArrowSquareOut, LinkSimple, Warning,
} from "@phosphor-icons/react";
import { useToast } from "@/context/ToastContext";
import { useCatalog } from "@/context/CatalogContext";
import PageLoader from "@/components/PageLoader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/teach/StatusBadge";
import { Card } from "@/components/admin/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { formatClock, formatMoney, inputClass, timeAgo } from "@/lib/teach";
import type { AdminCourseDetail } from "@/lib/admin";

const KIND_ICON = { VIDEO: VideoCamera, TEXT: Article, H5P: PuzzlePiece } as const;

export default function AdminCourseReview() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { push } = useToast();
  const { reload: reloadCatalog } = useCatalog();
  const [course, setCourse] = useState<AdminCourseDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<AdminCourseDetail>(`/manage/courses/${encodeURIComponent(id)}/`)
      .then((c) => { if (!cancelled) { setCourse(c); setNote(c.review_note); setState("ready"); } })
      .catch((err) => !cancelled && setState(err instanceof ApiError && err.status === 404 ? "missing" : "error"));
    return () => { cancelled = true; };
  }, [id]);

  if (state === "loading") return <PageLoader />;
  if (state !== "ready" || !course) {
    return <EmptyState title={state === "missing" ? "Course not found" : "Couldn't load this course"} ctaLabel="Back to courses" ctaTo="/admin/courses" />;
  }

  const decide = async (action: "approve" | "reject") => {
    setBusy(action);
    try {
      const updated = await api<AdminCourseDetail>(`/manage/courses/${course.id}/${action}/`, {
        method: "POST",
        body: action === "reject" ? { note } : undefined,
      });
      setCourse(updated);
      reloadCatalog();
      push(action === "approve" ? "Published. The teacher has been notified." : "Sent back to the teacher with your note.", "success");
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  };

  const lessons = course.modules.flatMap((m) => m.lessons);
  const missingVideos = lessons.filter((l) => l.kind === "VIDEO" && !l.video_url).length;
  const checks: [string, boolean][] = [
    ["Description of 30+ characters", !course.review_problems.some((p) => p.includes("description"))],
    ["At least one learning outcome", !course.review_problems.some((p) => p.includes("outcome"))],
    ["At least one lesson", !course.review_problems.some((p) => p.includes("lesson"))],
    ["Every video lesson has a video link", missingVideos === 0],
    ["At least one free preview lesson", lessons.some((l) => l.is_preview)],
  ];

  return (
    <div className="flex flex-col gap-7">
      <div>
        <Link href="/admin/courses" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink-muted hover:text-ink-strong no-underline mb-5">
          <ArrowLeft size={14} weight="bold" /> All courses
        </Link>
        <div className="relative overflow-hidden rounded-2xl text-white px-7 py-8" style={{ background: `linear-gradient(135deg, ${course.gradient_start}, ${course.gradient_end})` }}>
          <div aria-hidden="true" className="absolute inset-0 bg-ink-strong/70" />
          <div className="relative">
            <span className="inline-flex rounded-full bg-white/95"><StatusBadge status={course.status} /></span>
            <h1 className="font-display text-3xl md:text-4xl tracking-tighter font-semibold mt-3 leading-tight text-white">{course.title}</h1>
            <p className="text-white/75 text-sm mt-2">
              By <strong className="text-white">{course.teacher}</strong> ({course.teacher_email}) · {course.category} · {course.level} · {course.language}
            </p>
            <p className="text-white/75 text-sm mt-1">
              {course.lessons_count} lessons · {course.duration} · {course.price ? formatMoney(course.price) : "Free"} · updated {timeAgo(course.updated_at)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="flex flex-col gap-6">
          <Card title="About this course">
            <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{course.description || <em className="text-ink-muted">No description.</em>}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-strong mb-3">Students will learn</h3>
                <ul className="flex flex-col gap-2 text-sm">
                  {course.what_you_learn.length ? course.what_you_learn.map((o) => (
                    <li key={o} className="flex gap-2"><CheckCircle size={16} weight="fill" className="text-gold-dark flex-shrink-0 mt-0.5" />{o}</li>
                  )) : <li className="text-ink-muted">None listed.</li>}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-strong mb-3">Requirements</h3>
                <ul className="flex flex-col gap-2 text-sm list-disc pl-5">
                  {course.requirements.length ? course.requirements.map((r) => <li key={r}>{r}</li>) : <li className="list-none -ml-5 text-ink-muted">None.</li>}
                </ul>
              </div>
            </div>
          </Card>

          <Card title="Curriculum" description={`${course.modules.length} modules · ${lessons.length} lessons · ${course.duration}`}>
            <div className="flex flex-col gap-4">
              {course.modules.map((m, mi) => (
                <div key={m.id} className="border-2 border-line rounded-xl overflow-hidden">
                  <p className="px-4 py-3 bg-bg-soft text-sm font-semibold text-ink-strong">{mi + 1}. {m.title}</p>
                  <ul className="divide-y divide-line">
                    {m.lessons.map((l) => {
                      const Icon = KIND_ICON[l.kind];
                      return (
                        <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                          <Icon size={16} weight="duotone" className="text-gold-dark" />
                          <span className="flex-1 min-w-[160px] text-ink-strong">{l.title}</span>
                          {l.is_preview && <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-dark"><Eye size={12} /> Preview</span>}
                          {l.resources.length > 0 && <span className="inline-flex items-center gap-1 text-xs text-ink-muted"><LinkSimple size={12} /> {l.resources.length}</span>}
                          {l.kind === "VIDEO" && (l.video_url
                            ? <a href={l.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-gold-dark hover:text-gold">Watch <ArrowSquareOut size={12} /></a>
                            : <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-dark"><Warning size={12} /> No video</span>)}
                          <span className="text-xs text-ink-muted tabular-nums w-12 text-right">{formatClock(l.duration_seconds)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {!course.modules.length && <p className="text-sm text-ink-muted">This course has no lessons yet.</p>}
            </div>
          </Card>
        </div>

        <aside className="flex flex-col gap-5 xl:sticky xl:top-8">
          <Card title="Review checklist">
            <ul className="flex flex-col gap-2.5 text-sm">
              {checks.map(([label, ok]) => (
                <li key={label} className={`flex items-center gap-2 ${ok ? "text-ink" : "text-red-dark"}`}>
                  {ok ? <CheckCircle size={18} weight="fill" className="text-emerald-600" /> : <Circle size={18} />}
                  {label}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Decision">
            {course.status === "PUBLISHED" ? (
              <p className="text-sm text-ink mb-4">This course is live. {course.enrolled} student{course.enrolled === 1 ? "" : "s"} enrolled, {course.completed} finished.</p>
            ) : (
              <button
                onClick={() => decide("approve")}
                disabled={busy !== null}
                className="btn btn-md btn-primary btn-block mb-5 disabled:opacity-60"
              >
                <CheckCircle size={16} weight="bold" /> {busy === "approve" ? "Publishing…" : "Approve & publish"}
              </button>
            )}
            <label htmlFor="review-note" className="text-xs font-bold uppercase tracking-wider text-ink-strong">
              {course.status === "PUBLISHED" ? "Unpublish with a note" : "Or send back with a note"}
            </label>
            <textarea
              id="review-note"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What should the teacher change? e.g. Add a video link to lesson 3."
              className={`${inputClass} mt-2 resize-y`}
            />
            <button
              onClick={() => decide("reject")}
              disabled={busy !== null || note.trim().length < 10}
              className="btn btn-md btn-outline-neutral btn-block mt-3 disabled:opacity-50"
            >
              <XCircle size={16} weight="bold" /> {busy === "reject" ? "Sending…" : course.status === "PUBLISHED" ? "Unpublish" : "Request changes"}
            </button>
            {course.status === "PUBLISHED" && (
              <Link href={`/courses/${course.id}`} target="_blank" className="flex items-center justify-center gap-2 mt-4 text-sm font-bold text-gold-dark no-underline">
                View on student site <ArrowSquareOut size={14} />
              </Link>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
