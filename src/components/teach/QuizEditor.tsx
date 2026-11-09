"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle, Circle, ListChecks, PencilLine, Plus, Trash, X } from "@phosphor-icons/react";
import { useToast } from "@/context/ToastContext";
import { api, errorMessage } from "@/lib/api";
import { inputClass } from "@/lib/teach";

const MAX_OPTIONS = 6;
const MAX_QUESTIONS = 50;

type QuestionKind = "CHOICE" | "WRITTEN";

interface Question {
  kind: QuestionKind;
  prompt: string;
  options: string[];
  correct: number | null;
  model_answer: string;
  explanation: string;
}

const KINDS: { value: QuestionKind; label: string; icon: typeof ListChecks }[] = [
  { value: "CHOICE", label: "Multiple choice", icon: ListChecks },
  { value: "WRITTEN", label: "Written answer", icon: PencilLine },
];

interface QuizData {
  id: number | null;
  title: string;
  pass_percent: number;
  questions: Question[];
}

const blankQuestion = (kind: QuestionKind = "CHOICE"): Question =>
  ({ kind, prompt: "", options: ["", ""], correct: 0, model_answer: "", explanation: "" });

/** What's wrong with a question, in words a teacher can act on (null = fine). */
function problem(q: Question): string | null {
  if (!q.prompt.trim()) return "Write the question.";
  if (q.kind === "WRITTEN") return null;
  const filled = q.options.filter((o) => o.trim());
  if (filled.length < 2) return "Give at least two answer options.";
  if (q.correct === null || !q.options[q.correct]?.trim()) return "Mark which answer is correct.";
  return null;
}

/**
 * The chapter quiz students take after a module's lessons. Saved as a whole: the teacher edits
 * freely, then "Save quiz" replaces the questions.
 */
export default function QuizEditor({
  moduleId,
  run,
  onClose,
}: {
  moduleId: number;
  run: (action: () => Promise<unknown>, success?: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const { push } = useToast();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<QuizData>(`/teach/modules/${moduleId}/quiz/`)
      .then((q) => setQuiz({
        ...q,
        // Written questions come back without options; give them blanks in case the teacher switches type.
        questions: q.questions.length
          ? q.questions.map((x) => ({ ...x, options: x.options.length ? x.options : ["", ""], correct: x.correct ?? 0 }))
          : [blankQuestion()],
      }))
      .catch((err) => push(errorMessage(err), "error"));
  }, [moduleId, push]);

  if (!quiz) return <p className="px-5 py-6 text-sm text-ink-muted">Loading quiz…</p>;

  const setQ = (i: number, patch: Partial<Question>) =>
    setQuiz((z) => z && { ...z, questions: z.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  const move = (i: number, to: number) =>
    setQuiz((z) => {
      if (!z || to < 0 || to >= z.questions.length) return z;
      const qs = [...z.questions];
      [qs[i], qs[to]] = [qs[to], qs[i]];
      return { ...z, questions: qs };
    });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quiz.questions.some(problem) || !quiz.title.trim()) {
      setShowProblems(true);
      push("Some questions need a little more. See the highlighted ones.", "error");
      return;
    }
    // Drop empty options and keep "correct" pointing at the same answer.
    const questions = quiz.questions.map((q) => {
      if (q.kind === "WRITTEN") {
        return { kind: q.kind, prompt: q.prompt.trim(), model_answer: q.model_answer.trim(), explanation: q.explanation.trim() };
      }
      const kept = q.options.map((text, idx) => ({ text: text.trim(), idx })).filter((o) => o.text);
      return {
        kind: q.kind,
        prompt: q.prompt.trim(),
        options: kept.map((o) => o.text),
        correct: kept.findIndex((o) => o.idx === q.correct),
        explanation: q.explanation.trim(),
      };
    });
    setSaving(true);
    const ok = await run(
      () => api(`/teach/modules/${moduleId}/quiz/`, {
        method: "PUT",
        body: { title: quiz.title.trim(), pass_percent: quiz.pass_percent, questions },
      }),
      "Quiz saved",
    );
    setSaving(false);
    if (ok) onClose();
  };

  const remove = async () => {
    if (!window.confirm("Delete this chapter quiz? Students' scores for it are removed too.")) return;
    if (await run(() => api(`/teach/modules/${moduleId}/quiz/`, { method: "DELETE" }), "Quiz deleted")) onClose();
  };

  return (
    <form onSubmit={save} className="p-5 bg-gold-soft/30 flex flex-col gap-5" noValidate>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-semibold text-ink-strong">Chapter quiz</h4>
          <p className="text-xs text-ink-muted mt-0.5">
            Students take it after this chapter&apos;s lessons and must pass it to earn the certificate.
            Mix <strong className="text-ink-strong">multiple-choice</strong> questions (marked instantly) with
            {" "}<strong className="text-ink-strong">written answers</strong>, which you mark yourself under Reviews.
          </p>
        </div>
        <button type="button" onClick={onClose} className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:bg-white bg-transparent border-none cursor-pointer" aria-label="Close quiz editor">
          <X size={16} weight="bold" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-ink-strong uppercase tracking-wider">Quiz title</span>
          <input value={quiz.title} maxLength={200} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-ink-strong uppercase tracking-wider">Pass mark (%)</span>
          <input
            type="number" min={1} max={100} value={quiz.pass_percent}
            onChange={(e) => setQuiz({ ...quiz, pass_percent: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })}
            className={inputClass}
          />
        </label>
      </div>

      <ol className="flex flex-col gap-4">
        {quiz.questions.map((q, i) => {
          const issue = showProblems ? problem(q) : null;
          return (
            <li key={i} className={`bg-white rounded-xl border-2 p-4 flex flex-col gap-3 ${issue ? "border-red-300" : "border-line"}`}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gold-dark uppercase tracking-wider flex-1">Question {i + 1}</span>
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:bg-bg-soft bg-transparent border-none cursor-pointer disabled:opacity-30" aria-label="Move question up"><ArrowUp size={14} /></button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === quiz.questions.length - 1} className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:bg-bg-soft bg-transparent border-none cursor-pointer disabled:opacity-30" aria-label="Move question down"><ArrowDown size={14} /></button>
                <button
                  type="button"
                  onClick={() => setQuiz({ ...quiz, questions: quiz.questions.filter((_, j) => j !== i) })}
                  disabled={quiz.questions.length === 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-red-dark hover:bg-red-soft bg-transparent border-none cursor-pointer disabled:opacity-30"
                  aria-label={`Delete question ${i + 1}`}
                >
                  <Trash size={14} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2" role="group" aria-label={`Question ${i + 1} type`}>
                {KINDS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setQ(i, { kind: value })}
                    aria-pressed={q.kind === value}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 border-solid cursor-pointer transition-colors ${
                      q.kind === value ? "bg-ink-strong text-white border-ink-strong" : "bg-white text-ink border-line hover:border-gold"
                    }`}
                  >
                    <Icon size={14} weight={q.kind === value ? "fill" : "regular"} /> {label}
                  </button>
                ))}
              </div>

              <textarea
                value={q.prompt}
                rows={2}
                maxLength={1000}
                placeholder={q.kind === "WRITTEN"
                  ? "Type the question, e.g. In your own words, explain what a for-loop is for."
                  : "Type the question, e.g. What does a for-loop do?"}
                aria-label={`Question ${i + 1}`}
                onChange={(e) => setQ(i, { prompt: e.target.value })}
                className={`${inputClass} resize-y`}
              />

              {q.kind === "WRITTEN" ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-ink-muted">
                    Students type their answer. You read it under <strong className="text-ink-strong">Reviews</strong>,
                    mark it right or wrong and add feedback.
                  </p>
                  <textarea
                    value={q.model_answer}
                    rows={3}
                    maxLength={2000}
                    placeholder="Model answer (optional): what a good answer includes. Helps you mark, and students see it after marking."
                    aria-label={`Model answer for question ${i + 1}`}
                    onChange={(e) => setQ(i, { model_answer: e.target.value })}
                    className={`${inputClass} resize-y text-sm !border-emerald-200 !bg-emerald-50/40`}
                  />
                </div>
              ) : (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-xs text-ink-muted mb-1">Answers: click the circle next to the correct one.</legend>
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQ(i, { correct: oi })}
                      aria-pressed={q.correct === oi}
                      aria-label={`Mark answer ${oi + 1} as correct`}
                      className="flex-shrink-0 bg-transparent border-none p-0 cursor-pointer"
                    >
                      {q.correct === oi
                        ? <CheckCircle size={22} weight="fill" className="text-emerald-500" />
                        : <Circle size={22} className="text-line-strong hover:text-emerald-400" />}
                    </button>
                    <input
                      value={opt}
                      maxLength={300}
                      placeholder={`Answer ${oi + 1}`}
                      aria-label={`Answer ${oi + 1}`}
                      onChange={(e) => setQ(i, { options: q.options.map((o, k) => (k === oi ? e.target.value : o)) })}
                      className={`${inputClass} py-2 flex-1 ${q.correct === oi ? "!border-emerald-300 !bg-emerald-50/50" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setQ(i, {
                        options: q.options.filter((_, k) => k !== oi),
                        correct: q.correct === null || q.correct === oi ? 0 : q.correct > oi ? q.correct - 1 : q.correct,
                      })}
                      disabled={q.options.length <= 2}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-red-dark hover:bg-red-soft bg-transparent border-none cursor-pointer disabled:opacity-30"
                      aria-label={`Remove answer ${oi + 1}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {q.options.length < MAX_OPTIONS && (
                  <button type="button" onClick={() => setQ(i, { options: [...q.options, ""] })} className="self-start inline-flex items-center gap-1.5 text-xs font-bold text-gold-dark hover:text-gold bg-transparent border-none cursor-pointer px-0">
                    <Plus size={12} weight="bold" /> Add an answer
                  </button>
                )}
              </fieldset>
              )}

              {q.kind === "CHOICE" && <textarea
                value={q.explanation}
                rows={2}
                maxLength={1000}
                placeholder="Explanation (optional): why the right answer is right. Shown after students answer."
                aria-label={`Explanation for question ${i + 1}`}
                onChange={(e) => setQ(i, { explanation: e.target.value })}
                className={`${inputClass} resize-y text-sm`}
              />}
              {issue && <p role="alert" className="text-xs font-semibold text-red-dark">{issue}</p>}
            </li>
          );
        })}
      </ol>

      {quiz.questions.length < MAX_QUESTIONS && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {KINDS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setQuiz({ ...quiz, questions: [...quiz.questions, blankQuestion(value)] })}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-line-strong text-sm font-bold text-ink-strong bg-white hover:border-gold transition-colors cursor-pointer"
            >
              <Plus size={14} weight="bold" /> <Icon size={15} /> Add {label.toLowerCase()} question
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className="btn btn-md btn-primary disabled:opacity-60">
          {saving ? "Saving…" : "Save quiz"}
        </button>
        <button type="button" onClick={onClose} disabled={saving} className="btn btn-md btn-outline-neutral">Cancel</button>
        {quiz.id && (
          <button type="button" onClick={remove} disabled={saving} className="ml-auto btn btn-md btn-danger">
            Delete quiz
          </button>
        )}
      </div>
    </form>
  );
}
