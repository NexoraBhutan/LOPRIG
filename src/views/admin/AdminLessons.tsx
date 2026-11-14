"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowSquareOut, ArrowUUpLeft, CaretDown, CaretLeft, CaretRight, ChartBar, CheckCircle, Clock, PencilSimple,
  PlayCircle, Rows, SquaresFour, Tag, UsersThree, X,
} from "@phosphor-icons/react";
import PageLoader from "@/components/PageLoader";
import EmptyState from "@/components/EmptyState";
import UserAvatar from "@/components/UserAvatar";
import AdminDataTable from "@/views/admin/AdminDataTable";
import { useToast } from "@/context/ToastContext";
import { api, errorMessage, mediaUrl } from "@/lib/api";
import { formatMoney, timeAgo } from "@/lib/teach";

const MIN_REJECT_NOTE = 10; // same rule as the server

type Teacher = {
  id: number; name: string; email: string; headline: string; avatar: string; avatar_color: string;
  lesson_count: number; course_count: number; published_count: number;
};
type CourseCard = {
  id: string; title: string; status: "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "DRAFT";
  status_label: string; tone: "pending" | "live" | "rejected" | "draft";
  category: string; level: string; price: number | null; gradient_start: string; gradient_end: string; cover: string;
  teacher: { name: string; avatar_color: string };
  review_note: string; updated_at: string; published_at: string | null;
  lesson_count: number; duration: string; problems: string[];
  modules: { title: string; lessons: { id: number; title: string; kind: string; is_preview: boolean; duration_seconds: number }[] }[];
};
type Overview = {
  teachers: Teacher[]; selected: number | null; all_lessons_count: number; pending_total: number; courses: CourseCard[];
};

const TONE: Record<CourseCard["tone"], string> = {
  pending: "bg-gold text-ink-strong",
  live: "bg-emerald-600 text-white",
  rejected: "bg-red-600 text-white",
  draft: "bg-white/90 text-ink-strong",
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Lessons, laid out like Django Admin's Lessons page: teachers, courses to review, then the lesson table. */
export default function AdminLessons() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const teacherParam = params?.get("teacher") ?? "";
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [showTable, setShowTable] = useState(false);
  const row = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    const qs = teacherParam ? `?teacher=${encodeURIComponent(teacherParam)}` : "";
    return api<Overview>(`/manage/lessons/overview/${qs}`)
      .then((d) => { setData(d); setError(""); })
      .catch((err) => setError(errorMessage(err)));
  }, [teacherParam]);

  useEffect(() => { load(); }, [load]);

  // Clicking the selected teacher again shows everyone.
  const pickTeacher = (id: number | null) => {
    const qs = id && String(id) !== teacherParam ? `?teacher=${id}` : "";
    router.replace(`${pathname}${qs}`, { scroll: false });
  };

  const scrollTeachers = (dir: number) => {
    const el = row.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  if (error && !data) return <EmptyState title="Couldn't load lessons" description={error} ctaLabel="Dashboard" ctaTo="/admin" />;
  if (!data) return <PageLoader />;

  const selected = data.teachers.find((t) => t.id === data.selected) ?? null;
  const tableVisible = showTable || data.courses.length === 0;

  return (
    <div className="flex flex-col gap-10">
      {/* Teachers */}
      <section aria-label="Browse lessons by teacher" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-dark">Teachers</p>
            <h1 className="text-2xl md:text-3xl font-bold text-ink-strong mt-1">
              {selected ? `Lessons by ${selected.name}` : "Browse lessons by teacher"}
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              {selected
                ? `${plural(selected.lesson_count, "lesson")} across ${plural(selected.course_count, "course")}. Click the card again to see all lessons.`
                : "Pick a teacher to see only the lesson topics they teach."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selected && (
              <button type="button" onClick={() => pickTeacher(null)} className="btn btn-sm btn-outline-neutral inline-flex items-center gap-1.5">
                <X size={14} weight="bold" /> Show all teachers
              </button>
            )}
            {[-1, 1].map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => scrollTeachers(dir)}
                aria-label={dir < 0 ? "Scroll teachers left" : "Scroll teachers right"}
                className="w-10 h-10 rounded-full border-2 border-line bg-white text-ink-muted hover:text-ink-strong hover:border-ink-muted inline-flex items-center justify-center cursor-pointer transition-colors"
              >
                {dir < 0 ? <CaretLeft size={16} weight="bold" /> : <CaretRight size={16} weight="bold" />}
              </button>
            ))}
          </div>
        </div>

        <div ref={row} className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 [scrollbar-width:thin]">
          <TeacherCard
            active={!selected}
            onClick={() => pickTeacher(null)}
            avatar={<span className="w-14 h-14 rounded-full bg-ink-strong text-gold inline-flex items-center justify-center"><UsersThree size={26} weight="fill" /></span>}
            name="All teachers"
            subtitle={plural(data.teachers.length, "teacher")}
            stats={<span><strong className="text-ink-strong">{data.all_lessons_count}</strong> lessons</span>}
          />
          {data.teachers.map((t) => (
            <TeacherCard
              key={t.id}
              active={t.id === data.selected}
              onClick={() => pickTeacher(t.id)}
              title={t.id === data.selected ? "Show all teachers" : `Show lessons by ${t.name}`}
              avatar={<UserAvatar name={t.name} src={t.avatar} color={t.avatar_color} className="w-14 h-14 text-xl" />}
              name={t.name}
              subtitle={t.headline || t.email}
              stats={<>
                <span><strong className="text-ink-strong">{t.lesson_count}</strong> {t.lesson_count === 1 ? "lesson" : "lessons"}</span>
                <span><strong className="text-ink-strong">{t.course_count}</strong> {t.course_count === 1 ? "course" : "courses"}</span>
                {t.published_count > 0 && <span className="font-bold text-emerald-700">{t.published_count} live</span>}
              </>}
            />
          ))}
        </div>
      </section>

      {/* Courses */}
      <section aria-labelledby="lessons-courses-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-dark">{selected ? "Courses" : "Review requests"}</p>
            <h2 id="lessons-courses-title" className="text-2xl font-bold text-ink-strong mt-1 inline-flex items-center gap-2">
              {selected ? `${selected.name}’s courses` : "Courses awaiting your review"}
              {!selected && data.pending_total > 0 && (
                <span className="text-sm px-2.5 py-0.5 rounded-full bg-gold text-ink-strong tabular-nums">{data.pending_total}</span>
              )}
            </h2>
            <p className="text-sm text-ink-muted mt-1">
              {selected
                ? "Approve to publish a course, or send it back with a note. Open a card to check its lessons first."
                : data.pending_total
                  ? "Teachers submitted these. Check the lessons, then approve or reject."
                  : "Nothing to review right now. Pick a teacher above to see all their courses."}
            </p>
          </div>
          {data.courses.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTable((s) => !s)}
              aria-expanded={tableVisible}
              aria-controls="lessons-table"
              className="btn btn-sm btn-outline-neutral inline-flex items-center gap-2"
            >
              <Rows size={16} weight="bold" /> {tableVisible ? "Hide lesson table" : "Show lesson table"}
            </button>
          )}
        </div>

        {data.courses.length ? (
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {data.courses.map((c) => <ReviewCard key={c.id} course={c} showTeacher={!selected} onChanged={load} />)}
          </div>
        ) : (
          <p className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-line px-6 py-6 text-ink">
            <CheckCircle size={22} weight="duotone" className="text-emerald-600 flex-shrink-0" />
            {selected ? `${selected.name} has no courses yet.` : "All caught up: no courses are waiting for review."}
          </p>
        )}
      </section>

      {/* Every lesson, filtered to the chosen teacher */}
      {tableVisible && (
        <section id="lessons-table" aria-label="Lesson table">
          <AdminDataTable
            key={selected?.id ?? "all"} // another teacher starts again at page 1
            table="lessons"
            embedded
            fixedFilters={selected ? { module__course__teacher: String(selected.id) } : undefined}
          />
        </section>
      )}
    </div>
  );
}

function TeacherCard({ active, onClick, avatar, name, subtitle, stats, title }: {
  active: boolean; onClick: () => void; avatar: React.ReactNode; name: string; subtitle: string;
  stats: React.ReactNode; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`relative snap-start flex-shrink-0 w-[260px] sm:w-[290px] text-left flex flex-col gap-1 rounded-2xl border-2 p-5 cursor-pointer transition-all ${
        active ? "border-gold bg-gold-soft/60 shadow-[0_0_0_4px_rgba(255,182,6,0.15)]" : "border-line bg-white hover:border-gold/60 hover:-translate-y-0.5"
      }`}
    >
      {active && <CheckCircle size={20} weight="fill" className="absolute top-4 right-4 text-gold-dark" aria-hidden="true" />}
      <span className="mb-3">{avatar}</span>
      <span className="font-bold text-lg text-ink-strong truncate">{name}</span>
      <span className="text-sm text-ink-muted line-clamp-2 min-h-[2.5rem]">{subtitle}</span>
      <span className="mt-3 pt-3 border-t border-line flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">{stats}</span>
    </button>
  );
}

function ReviewCard({ course: c, showTeacher, onChanged }: { course: CourseCard; showTeacher: boolean; onChanged: () => void }) {
  const { push } = useToast();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  const decide = async (action: "approve" | "reject") => {
    if (action === "approve" && !window.confirm(`Approve and publish “${c.title}”? Students can enroll right away.`)) return;
    setBusy(action);
    try {
      await api(`/manage/courses/${c.id}/${action}/`, { method: "POST", body: action === "reject" ? { note: note.trim() } : undefined });
      push(action === "approve"
        ? `Approved: “${c.title}” is now live. ${c.teacher.name} was notified.`
        : `Sent back to ${c.teacher.name} with your note.`, "success");
      setRejecting(false);
      setNote("");
      onChanged();
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  };

  const when = c.status === "PENDING_REVIEW" ? `Submitted ${timeAgo(c.updated_at)}`
    : c.status === "PUBLISHED" && c.published_at ? `Live since ${new Date(c.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
      : `Updated ${timeAgo(c.updated_at)}`;
  const cover = mediaUrl(c.cover);

  return (
    <article className="flex flex-col bg-white border-2 border-line rounded-2xl overflow-hidden">
      <div
        className="relative h-28 flex items-start justify-between gap-2 p-4 bg-cover bg-center"
        style={{ backgroundImage: cover ? `linear-gradient(rgba(0,0,0,.15), rgba(0,0,0,.35)), url(${cover})` : `linear-gradient(135deg, ${c.gradient_start}, ${c.gradient_end})` }}
      >
        <span className={`px-2.5 py-1 rounded-full text-[0.7rem] font-bold uppercase tracking-wider ${TONE[c.tone]}`}>{c.status_label}</span>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-black/30 text-white backdrop-blur-sm truncate">{c.category}</span>
      </div>

      <div className="flex flex-col gap-3 p-5 flex-1">
        <h3 className="text-lg font-bold text-ink-strong leading-snug">{c.title}</h3>
        {showTeacher && (
          <p className="flex items-center gap-2 text-sm text-ink">
            <UserAvatar name={c.teacher.name} color={c.teacher.avatar_color} className="w-6 h-6 text-[0.65rem]" />
            {c.teacher.name}
          </p>
        )}
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-muted list-none p-0 m-0">
          <li className="inline-flex items-center gap-1.5"><ChartBar size={15} />{c.level}</li>
          <li className="inline-flex items-center gap-1.5"><SquaresFour size={15} />{plural(c.modules.length, "module")}</li>
          <li className="inline-flex items-center gap-1.5"><PlayCircle size={15} />{plural(c.lesson_count, "lesson")}</li>
          <li className="inline-flex items-center gap-1.5"><Clock size={15} />{c.duration}</li>
          <li className="inline-flex items-center gap-1.5"><Tag size={15} />{c.price === null ? "Free" : formatMoney(c.price)}</li>
        </ul>
        <p className="text-xs text-ink-muted">{when}</p>

        {c.problems.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            <strong>Still missing</strong>
            <ul className="list-disc pl-5 mt-1">{c.problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
        {c.status === "REJECTED" && c.review_note && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900">
            <strong>Your note to the teacher</strong>
            <p className="mt-1">{c.review_note}</p>
          </div>
        )}

        <details className="group rounded-xl bg-bg-soft px-4 py-3 text-sm">
          <summary className="flex items-center gap-1.5 font-semibold text-ink-strong cursor-pointer list-none">
            <CaretDown size={14} weight="bold" className="transition-transform group-open:rotate-180" />
            Check the {plural(c.lesson_count, "lesson")}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {c.modules.length ? c.modules.map((m, i) => (
              <div key={`${i}-${m.title}`}>
                <p className="font-semibold text-ink-strong">{i + 1}. {m.title}</p>
                {m.lessons.length ? (
                  <ol className="mt-1 pl-5 flex flex-col gap-1">
                    {m.lessons.map((l) => (
                      <li key={l.id} className="text-ink">
                        <Link href={`/admin/data/lessons/${l.id}`} className="text-ink hover:text-gold-dark no-underline">{l.title}</Link>
                        {l.is_preview && <span className="ml-2 px-1.5 py-0.5 rounded bg-gold-soft text-[0.65rem] font-bold uppercase text-gold-dark">Preview</span>}
                        <span className="ml-2 text-xs text-ink-muted">{l.kind} · {l.duration_seconds}s</span>
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-ink-muted mt-1">No lessons in this module yet.</p>}
              </div>
            )) : <p className="text-ink-muted">This course has no modules yet.</p>}
          </div>
        </details>

        {rejecting && (
          <form
            onSubmit={(e) => { e.preventDefault(); decide("reject"); }}
            className="flex flex-col gap-2 rounded-xl border-2 border-red-200 bg-red-50/50 p-4"
          >
            <label htmlFor={`note-${c.id}`} className="text-sm font-semibold text-ink-strong">What should {c.teacher.name} fix?</label>
            <textarea
              id={`note-${c.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              required
              minLength={MIN_REJECT_NOTE}
              placeholder="e.g. Please add captions to the videos in module 2."
              className="rounded-lg border-2 border-line bg-white px-3 py-2 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setRejecting(false)} className="btn btn-sm btn-outline-neutral">Cancel</button>
              <button type="submit" disabled={busy !== null || note.trim().length < MIN_REJECT_NOTE} className="btn btn-sm btn-danger disabled:opacity-50">
                {busy === "reject" ? "Sending…" : "Send back to teacher"}
              </button>
            </div>
          </form>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4">
        {c.status === "PENDING_REVIEW" ? (
          <>
            <button type="button" onClick={() => decide("approve")} disabled={busy !== null} className="btn btn-sm btn-primary inline-flex items-center gap-1.5 disabled:opacity-60">
              <CheckCircle size={15} weight="bold" /> {busy === "approve" ? "Publishing…" : "Approve & publish"}
            </button>
            {!rejecting && (
              <button type="button" onClick={() => setRejecting(true)} className="btn btn-sm btn-outline-neutral inline-flex items-center gap-1.5 text-red-dark">
                <ArrowUUpLeft size={15} weight="bold" /> Reject
              </button>
            )}
          </>
        ) : c.status === "PUBLISHED" ? (
          <Link href={`/courses/${c.id}`} target="_blank" rel="noopener" className="btn btn-sm btn-outline-neutral no-underline inline-flex items-center gap-1.5">
            <ArrowSquareOut size={15} weight="bold" /> View on site
          </Link>
        ) : (
          <span className="text-sm text-ink-muted">
            {c.status === "REJECTED" ? "Waiting for the teacher to fix and resubmit" : "The teacher is still building this course"}
          </span>
        )}
        <Link href={`/admin/courses/${c.id}`} className="ml-auto btn btn-sm btn-outline-neutral no-underline inline-flex items-center gap-1.5">
          <PencilSimple size={15} weight="bold" /> Open course
        </Link>
      </footer>
    </article>
  );
}
