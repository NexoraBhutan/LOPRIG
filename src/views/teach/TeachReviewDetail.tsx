"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCircle, Lightbulb, ListChecks, PencilLine, X, XCircle } from "@phosphor-icons/react";
import PageLoader from "@/components/PageLoader";
import EmptyState from "@/components/EmptyState";
import UserAvatar from "@/components/UserAvatar";
import { useToast } from "@/context/ToastContext";
import { api, errorMessage } from "@/lib/api";
import { inputClass, timeAgo, type ReviewDetail } from "@/lib/teach";

const LETTERS = "ABCDEF";

type Marks = Record<number, { correct: boolean | null; feedback: string }>;

/**
 * Mark one student's chapter quiz: multiple-choice answers are already marked; the teacher decides
 * on each written answer, sees the score update live, and saves once.
 */
export default function TeachReviewDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const [attempt, setAttempt] = useState<ReviewDetail | null>(null);
  const [error, setError] = useState("");
  const [marks, setMarks] = useState<Marks>({});
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<ReviewDetail>(`/teach/reviews/${params?.id}/`)
      .then((a) => {
        setAttempt(a);
        setFeedback(a.feedback);
        setMarks(Object.fromEntries(
          a.questions.filter((q) => q.kind === "WRITTEN")
            .map((q) => [q.id, { correct: q.mark?.correct ?? null, feedback: q.mark?.feedback ?? "" }]),
        ));
      })
      .catch((err) => setError(errorMessage(err)));
  }, [params?.id]);

  if (error) return <EmptyState title="Couldn't open these answers" description={error} ctaLabel="Back to reviews" ctaTo="/teach/reviews" />;
  if (!attempt) return <PageLoader />;

  const readOnly = attempt.status !== "PENDING";
  const written = attempt.questions.filter((q) => q.kind === "WRITTEN");
  const unmarked = written.filter((q) => marks[q.id]?.correct === null).length;
  const correct = attempt.questions.filter((q) =>
    q.kind === "WRITTEN" ? marks[q.id]?.correct === true : q.answer !== null && q.answer === q.correct,
  ).length;
  const score = Math.round((100 * correct) / attempt.questions.length);
  const passes = score >= attempt.pass_percent;
  const firstName = attempt.student.name.split(" ")[0];

  const setMark = (id: number, patch: Partial<Marks[number]>) =>
    setMarks((m) => ({ ...m, [id]: { ...m[id], ...patch } }));

  const save = async () => {
    if (unmarked || saving) return;
    setSaving(true);
    try {
      await api(`/teach/reviews/${attempt.id}/`, {
        method: "POST",
        body: {
          marks: written.map((q) => ({ question: q.id, correct: marks[q.id].correct, feedback: marks[q.id].feedback.trim() })),
          feedback: feedback.trim(),
        },
      });
      push(`Marked. ${firstName} has been sent their score and feedback.`, "success");
      router.push("/teach/reviews");
    } catch (err) {
      push(errorMessage(err), "error");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[860px]">
      <Link href="/teach/reviews" className="self-start inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink-strong no-underline">
        <ArrowLeft size={14} weight="bold" /> All reviews
      </Link>

      <header className="bg-white border-2 border-line rounded-2xl p-6 flex flex-wrap items-center gap-5">
        <UserAvatar name={attempt.student.name} src={attempt.student.avatar} className="w-14 h-14 text-lg" />
        <div className="flex-1 min-w-[220px]">
          <h1 className="font-display text-2xl font-semibold text-ink-strong tracking-tight">{attempt.student.name}</h1>
          <p className="text-sm text-ink-muted">{attempt.student.email}</p>
          <p className="text-sm text-ink mt-2">
            <strong className="text-ink-strong">{attempt.quiz}</strong> · {attempt.chapter} · {attempt.course.title}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">
            Sent {timeAgo(attempt.submitted_at)}{attempt.reviewed_at ? ` · marked ${timeAgo(attempt.reviewed_at)}` : ""}
          </p>
        </div>
        <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center flex-shrink-0 border-4 ${
          readOnly || !unmarked ? (passes ? "border-emerald-400 text-emerald-700" : "border-red-300 text-red-dark") : "border-line text-ink-muted"
        }`}>
          <span className="text-2xl font-bold tabular-nums leading-none">{score}%</span>
          <span className="text-[0.6rem] font-bold uppercase tracking-wider mt-1">pass {attempt.pass_percent}%</span>
        </div>
      </header>

      <ol className="flex flex-col gap-4">
        {attempt.questions.map((q, i) => (
          <li key={q.id} className="bg-white border-2 border-line rounded-2xl p-5 sm:p-6">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-dark mb-2">
              {q.kind === "WRITTEN" ? <PencilLine size={14} /> : <ListChecks size={14} />}
              Question {i + 1} · {q.kind === "WRITTEN" ? "Written answer" : "Multiple choice"}
            </p>
            <p className="text-base font-semibold text-ink-strong leading-snug whitespace-pre-line">{q.prompt}</p>

            {q.kind === "CHOICE" ? (
              <ChoiceSummary options={q.options} chosen={q.answer as number | null} correct={q.correct} />
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <div className="rounded-xl bg-bg-soft border border-line px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-1">Student&apos;s answer</p>
                  <p className="text-sm text-ink-strong whitespace-pre-line break-words">
                    {(q.answer as string) || <em className="text-ink-muted">No answer given.</em>}
                  </p>
                </div>
                {q.model_answer && (
                  <p className="flex gap-2 text-sm rounded-xl px-4 py-3 bg-emerald-50/70 text-emerald-950">
                    <Lightbulb size={18} weight="duotone" className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Your model answer:</strong> <span className="whitespace-pre-line">{q.model_answer}</span></span>
                  </p>
                )}
                <div className="flex flex-wrap gap-2" role="group" aria-label={`Mark question ${i + 1}`}>
                  <MarkButton
                    active={marks[q.id]?.correct === true} disabled={readOnly} tone="good"
                    onClick={() => setMark(q.id, { correct: true })}
                  >
                    <Check size={15} weight="bold" /> Correct
                  </MarkButton>
                  <MarkButton
                    active={marks[q.id]?.correct === false} disabled={readOnly} tone="bad"
                    onClick={() => setMark(q.id, { correct: false })}
                  >
                    <X size={15} weight="bold" /> Not correct
                  </MarkButton>
                </div>
                {readOnly ? (
                  marks[q.id]?.feedback && <p className="text-sm text-ink"><strong>Your feedback:</strong> {marks[q.id].feedback}</p>
                ) : (
                  <>
                    <label htmlFor={`fb-${q.id}`} className="sr-only">Feedback on question {i + 1}</label>
                    <textarea
                      id={`fb-${q.id}`}
                      rows={2}
                      maxLength={1000}
                      value={marks[q.id]?.feedback ?? ""}
                      onChange={(e) => setMark(q.id, { feedback: e.target.value })}
                      placeholder="Feedback on this answer (optional), e.g. Good start. Also mention…"
                      className={`${inputClass} resize-y text-sm`}
                    />
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      <section className="bg-white border-2 border-line rounded-2xl p-5 sm:p-6 flex flex-col gap-3">
        <label htmlFor="overall-feedback" className="text-xs font-bold uppercase tracking-wider text-ink-strong">
          Note to {firstName}
        </label>
        {readOnly ? (
          <p className="text-sm text-ink whitespace-pre-line">{feedback || <em className="text-ink-muted">No note.</em>}</p>
        ) : (
          <textarea
            id="overall-feedback"
            rows={3}
            maxLength={2000}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="A few encouraging words (optional). Sent with their score."
            className={`${inputClass} resize-y`}
          />
        )}
      </section>

      {!readOnly && (
        <div className="sticky bottom-4 z-10 bg-ink-strong text-white rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4 shadow-lg">
          <p className="flex-1 min-w-[200px] text-sm">
            {unmarked
              ? `Mark ${unmarked} more written ${unmarked === 1 ? "answer" : "answers"} to finish.`
              : <>Score <strong className="tabular-nums">{score}%</strong>: {passes ? "passes" : `doesn't reach the ${attempt.pass_percent}% pass mark`}.</>}
          </p>
          <button type="button" onClick={save} disabled={Boolean(unmarked) || saving} className="btn btn-md btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? "Saving…" : "Save and send to student"}
          </button>
        </div>
      )}
    </div>
  );
}

function ChoiceSummary({ options, chosen, correct }: { options: string[]; chosen: number | null; correct: number | null }) {
  const right = chosen !== null && chosen === correct;
  return (
    <div className="mt-4 flex flex-col gap-2">
      {options.map((opt, oi) => {
        const isRight = oi === correct;
        const picked = oi === chosen;
        return (
          <div
            key={oi}
            className={`flex items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-sm ${
              isRight ? "border-emerald-400 bg-emerald-50" : picked ? "border-red-300 bg-red-soft/60" : "border-line opacity-70"
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-bg-sunken flex items-center justify-center text-xs font-bold text-ink-strong">{LETTERS[oi]}</span>
            <span className="flex-1 text-ink-strong">{opt}</span>
            {picked && <span className="text-xs font-bold text-ink-muted">Student&apos;s pick</span>}
            {isRight && <CheckCircle size={18} weight="fill" className="text-emerald-500" aria-label="Correct answer" />}
            {picked && !isRight && <XCircle size={18} weight="fill" className="text-red-500" aria-label="Wrong pick" />}
          </div>
        );
      })}
      <p className="text-xs text-ink-muted">
        Marked automatically: {chosen === null ? "not answered" : right ? "correct" : "not correct"}.
      </p>
    </div>
  );
}

function MarkButton({
  active, disabled, tone, onClick, children,
}: {
  active: boolean;
  disabled: boolean;
  tone: "good" | "bad";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const on = tone === "good" ? "bg-emerald-500 border-emerald-500 text-white" : "bg-red-500 border-red-500 text-white";
  const off = tone === "good" ? "hover:border-emerald-400 hover:text-emerald-700" : "hover:border-red-300 hover:text-red-dark";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border-2 border-solid transition-colors cursor-pointer disabled:cursor-default ${
        active ? on : `bg-white border-line text-ink ${disabled ? "opacity-50" : off}`
      }`}
    >
      {children}
    </button>
  );
}
