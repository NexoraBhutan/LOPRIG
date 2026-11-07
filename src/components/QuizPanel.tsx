"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowCounterClockwise, CheckCircle, Exam, XCircle, Certificate, Hourglass, ChatCircleText, Lightbulb,
} from "@phosphor-icons/react";
import { useToast } from "@/context/ToastContext";
import { api, errorMessage } from "@/lib/api";

type Answer = number | string | null;

interface StudentQuestion {
  id: number;
  kind: "CHOICE" | "WRITTEN";
  prompt: string;
  options: string[];
}

interface ChoiceResult {
  question: number;
  kind: "CHOICE";
  chosen: number | null;
  correct: number;
  is_correct: boolean;
  explanation: string;
}

interface WrittenResult {
  question: number;
  kind: "WRITTEN";
  text: string;
  /** null while the teacher hasn't marked it yet. */
  is_correct: boolean | null;
  feedback: string;
  model_answer: string;
  explanation: string;
}

/** One attempt as the student sees it. PENDING = written answers waiting for the teacher. */
export interface AttemptResult {
  id: number;
  status: "GRADED" | "PENDING" | "REVIEWED";
  score: number | null;
  passed: boolean;
  correct_count: number;
  total: number;
  pass_percent: number;
  questions: StudentQuestion[];
  results: (ChoiceResult | WrittenResult)[];
  feedback: string;
}

export interface QuizResult extends AttemptResult {
  course_progress: { completed_lessons: number; total_lessons: number; passed_quizzes: number; total_quizzes: number; percent: number };
  course_completed: boolean;
  certificate: string | null;
}

interface StudentQuiz {
  id: number;
  title: string;
  pass_percent: number;
  chapter: string;
  questions: StudentQuestion[];
  best_score: number | null;
  passed: boolean;
  attempts: number;
  pending: boolean;
  /** The latest attempt with written answers (waiting, or marked with feedback). */
  latest: AttemptResult | null;
}

const LETTERS = "ABCDEF";
const WRITTEN_MAX = 5000;

const isAnswered = (q: StudentQuestion, a: Answer) =>
  q.kind === "WRITTEN" ? typeof a === "string" && a.trim().length > 0 : a !== null;

/**
 * A chapter test: multiple-choice questions are marked straight away; written answers go to the
 * teacher, and the student sees their marks and feedback here once reviewed.
 */
export default function QuizPanel({
  quizId,
  canAttempt,
  loginHref,
  onResult,
  onContinue,
  continueLabel,
}: {
  quizId: number;
  /** False for visitors and staff previews: they can read the questions but nothing is graded. */
  canAttempt: boolean;
  loginHref: string;
  onResult: (quizId: number, result: QuizResult) => void;
  onContinue?: () => void;
  continueLabel?: string;
}) {
  const { push } = useToast();
  const [quiz, setQuiz] = useState<StudentQuiz | null>(null);
  const [failed, setFailed] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [certificate, setCertificate] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    setQuiz(null);
    setResult(null);
    setCertificate(null);
    setFailed(false);
    api<StudentQuiz>(`/learning/quizzes/${quizId}/`)
      .then((q) => {
        if (!alive) return;
        setQuiz(q);
        setAnswers(q.questions.map(() => null));
        if (q.latest) setResult(q.latest); // waiting for the teacher, or their marks and feedback
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [quizId]);

  if (failed) return <p className="rounded-2xl bg-white border-2 border-line p-6 text-sm text-ink-muted">Couldn&apos;t load this quiz. Refresh the page to try again.</p>;
  if (!quiz) return <p className="rounded-2xl bg-white border-2 border-line p-6 text-sm text-ink-muted">Loading quiz…</p>;

  // A marked attempt shows the questions as they were when answered.
  const questions = result ? result.questions : quiz.questions;
  const total = quiz.questions.length;
  const answered = quiz.questions.filter((q, i) => isAnswered(q, answers[i])).length;
  const hasWritten = quiz.questions.some((q) => q.kind === "WRITTEN");
  const pending = result?.status === "PENDING";
  const choiceResults = result?.results.filter((r): r is ChoiceResult => r.kind === "CHOICE") ?? [];

  const submit = async () => {
    if (!canAttempt || answered < total || sending) return;
    setSending(true);
    try {
      const res = await api<QuizResult>(`/learning/quizzes/${quiz.id}/attempt/`, { method: "POST", body: { answers } });
      setResult(res);
      setQuiz((q) => q && {
        ...q,
        best_score: res.score === null ? q.best_score : Math.max(q.best_score ?? 0, res.score),
        passed: q.passed || res.passed,
        pending: res.status === "PENDING",
        attempts: q.attempts + 1,
      });
      onResult(quiz.id, res);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (res.status === "PENDING") push("Answers sent! Your teacher will mark them soon.", "success");
      if (res.course_completed && res.certificate) {
        setCertificate(res.certificate);
        push("You've completed the course! Your certificate is ready.", "success");
      }
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  };

  const retry = () => {
    setResult(null);
    setAnswers(quiz.questions.map(() => null));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setAnswer = (qi: number, value: Answer) => setAnswers((a) => a.map((v, k) => (k === qi ? value : v)));

  return (
    <div className="rounded-2xl bg-white border-2 border-line overflow-hidden">
      {/* Header */}
      <div className="px-5 sm:px-8 py-6 bg-ink-strong text-white">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold">
          <Exam size={16} weight="duotone" /> Chapter quiz · {quiz.chapter}
        </p>
        <h1 className="mt-2 text-xl md:text-2xl font-semibold leading-snug">{quiz.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-white/10 px-3 py-1">{total} {total === 1 ? "question" : "questions"}</span>
          <span className="rounded-full bg-white/10 px-3 py-1">Pass mark {quiz.pass_percent}%</span>
          {hasWritten && <span className="rounded-full bg-white/10 px-3 py-1">Includes written answers</span>}
          {quiz.pending && <span className="rounded-full bg-gold/20 text-gold px-3 py-1">Waiting for review</span>}
          {quiz.best_score !== null && (
            <span className={`rounded-full px-3 py-1 ${quiz.passed ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10"}`}>
              {quiz.passed ? "Passed · " : ""}Best score {quiz.best_score}%
            </span>
          )}
        </div>
      </div>

      {/* Waiting for the teacher */}
      {result && pending && (
        <div className="px-5 sm:px-8 py-6 border-b-2 bg-gold-soft/60 border-gold-soft" role="status">
          <div className="flex flex-wrap items-center gap-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 bg-white text-gold-dark border-2 border-gold/40">
              <Hourglass size={34} weight="duotone" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-lg font-semibold text-ink-strong">Sent to your teacher for marking</p>
              <p className="text-sm text-ink-muted mt-0.5">
                {choiceResults.length > 0 &&
                  `${choiceResults.filter((r) => r.is_correct).length} of ${choiceResults.length} multiple-choice answers are correct. `}
                Your teacher will read your written answers, and you&apos;ll get a notification and an email with your
                score and feedback. Keep learning in the meantime.
              </p>
            </div>
          </div>
          {onContinue && (
            <div className="mt-5">
              <button type="button" onClick={onContinue} className="btn btn-md btn-primary">
                {continueLabel ?? "Continue"} <ArrowRight size={14} weight="bold" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Marked */}
      {result && !pending && result.score !== null && (
        <div className={`px-5 sm:px-8 py-6 border-b-2 ${result.passed ? "bg-emerald-50 border-emerald-100" : "bg-red-soft/50 border-red-soft"}`} role="status">
          <div className="flex flex-wrap items-center gap-5">
            <div className={`w-20 h-20 rounded-full flex flex-col items-center justify-center font-bold flex-shrink-0 ${result.passed ? "bg-emerald-500 text-white" : "bg-white text-red-dark border-2 border-red-200"}`}>
              <span className="text-2xl leading-none tabular-nums">{result.score}%</span>
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-lg font-semibold text-ink-strong">
                {result.passed ? "Well done, you passed!" : "Not quite there yet"}
              </p>
              <p className="text-sm text-ink-muted mt-0.5">
                {result.correct_count} of {result.total} correct{result.status === "REVIEWED" ? ", marked by your teacher" : ""}.{" "}
                {result.passed
                  ? "Review the answers below, then carry on."
                  : `You need ${result.pass_percent}% to pass. Look over the feedback and try again: you can retry as often as you like.`}
              </p>
            </div>
          </div>
          {result.feedback && (
            <div className="mt-5 flex gap-3 rounded-xl bg-white border border-line px-4 py-3">
              <ChatCircleText size={20} weight="duotone" className="text-gold-dark flex-shrink-0 mt-0.5" />
              <p className="text-sm text-ink">
                <strong className="block text-ink-strong">Your teacher says</strong>
                <span className="whitespace-pre-line">{result.feedback}</span>
              </p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {certificate && (
              <Link href={`/certificates/${certificate}`} className="btn btn-md btn-primary no-underline">
                <Certificate size={15} weight="fill" /> View your certificate
              </Link>
            )}
            {result.passed && onContinue && !certificate && (
              <button type="button" onClick={onContinue} className="btn btn-md btn-primary">
                {continueLabel ?? "Continue"} <ArrowRight size={14} weight="bold" />
              </button>
            )}
            {canAttempt && (
              <button type="button" onClick={retry} className="btn btn-md btn-outline-neutral">
                <ArrowCounterClockwise size={14} weight="bold" /> Try again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Questions */}
      <ol className="px-5 sm:px-8 py-6 flex flex-col gap-8">
        {questions.map((q, qi) => {
          const r = result?.results[qi];
          return (
            <li key={q.id}>
              <fieldset>
                <legend className="text-base font-semibold text-ink-strong leading-snug">
                  <span className="text-gold-dark mr-2">{qi + 1}.</span>{q.prompt}
                </legend>
                {q.kind === "WRITTEN" ? (
                  <WrittenAnswer
                    id={`q-${q.id}`}
                    value={typeof answers[qi] === "string" ? (answers[qi] as string) : ""}
                    result={r?.kind === "WRITTEN" ? r : undefined}
                    disabled={!canAttempt}
                    onChange={(text) => setAnswer(qi, text)}
                  />
                ) : (
                  <ChoiceAnswer
                    question={q}
                    chosen={r?.kind === "CHOICE" ? r.chosen : (answers[qi] as number | null)}
                    result={r?.kind === "CHOICE" ? r : undefined}
                    onChoose={(oi) => setAnswer(qi, oi)}
                  />
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {/* Submit */}
      {!result && (
        <div className="sticky bottom-0 px-5 sm:px-8 py-4 border-t-2 border-line bg-white/95 backdrop-blur flex flex-wrap items-center justify-between gap-3">
          {canAttempt ? (
            <>
              <span className="text-sm text-ink-muted tabular-nums">{answered} of {total} answered</span>
              <button type="button" onClick={submit} disabled={answered < total || sending} className="btn btn-md btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                {sending ? "Sending…" : hasWritten ? "Submit for marking" : "Submit answers"}
              </button>
            </>
          ) : (
            <p className="text-sm text-ink-muted">
              <Link href={loginHref} className="font-bold text-gold-dark hover:text-gold">Log in</Link> as a student to take this quiz and save your score.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ChoiceAnswer({
  question, chosen, result, onChoose,
}: {
  question: StudentQuestion;
  chosen: number | null;
  result?: ChoiceResult;
  onChoose: (option: number) => void;
}) {
  return (
    <>
      <div className="mt-3 flex flex-col gap-2">
        {question.options.map((opt, oi) => {
          const picked = chosen === oi;
          const isRight = result && result.correct === oi;
          const isWrongPick = result && picked && !result.is_correct;
          const tone = result
            ? isRight ? "border-emerald-400 bg-emerald-50" : isWrongPick ? "border-red-300 bg-red-soft/60" : "border-line opacity-70"
            : picked ? "border-gold bg-gold-soft" : "border-line hover:border-gold/60 hover:bg-bg-soft";
          return (
            <label key={oi} className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${result ? "cursor-default" : "cursor-pointer"} ${tone}`}>
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={picked}
                disabled={Boolean(result)}
                onChange={() => onChoose(oi)}
                className="sr-only"
              />
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${picked && !result ? "bg-ink-strong text-white" : "bg-bg-sunken text-ink-strong"}`}>
                {LETTERS[oi]}
              </span>
              <span className="flex-1 text-sm text-ink-strong">{opt}</span>
              {isRight && <CheckCircle size={20} weight="fill" className="text-emerald-500 flex-shrink-0" aria-label="Correct answer" />}
              {isWrongPick && <XCircle size={20} weight="fill" className="text-red-500 flex-shrink-0" aria-label="Your answer" />}
            </label>
          );
        })}
      </div>
      {result && (
        <p className={`mt-3 text-sm rounded-xl px-4 py-3 ${result.is_correct ? "bg-emerald-50 text-emerald-900" : "bg-bg-soft text-ink"}`}>
          <strong>{result.is_correct ? "Correct." : result.chosen === null ? "Not answered." : `The answer is ${LETTERS[result.correct]}.`}</strong>
          {result.explanation && <> {result.explanation}</>}
        </p>
      )}
    </>
  );
}

function WrittenAnswer({
  id, value, result, disabled, onChange,
}: {
  id: string;
  value: string;
  result?: WrittenResult;
  disabled: boolean;
  onChange: (text: string) => void;
}) {
  if (!result) {
    return (
      <div className="mt-3">
        <label htmlFor={id} className="sr-only">Your answer</label>
        <textarea
          id={id}
          value={value}
          rows={5}
          maxLength={WRITTEN_MAX}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your answer in your own words…"
          className="w-full rounded-xl border-2 border-line bg-white px-4 py-3 text-sm text-ink-strong leading-relaxed resize-y focus:outline-none focus:border-gold transition-colors disabled:bg-bg-soft"
        />
        <p className="mt-1 flex justify-between gap-3 text-xs text-ink-muted">
          <span>Your teacher reads and marks this answer.</span>
          <span className="tabular-nums">{value.length.toLocaleString()} / {WRITTEN_MAX.toLocaleString()}</span>
        </p>
      </div>
    );
  }

  const tone = result.is_correct === null
    ? "border-gold/50 bg-gold-soft/30"
    : result.is_correct ? "border-emerald-400 bg-emerald-50" : "border-red-300 bg-red-soft/40";
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className={`rounded-xl border-2 px-4 py-3 ${tone}`}>
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1.5">
          {result.is_correct === null && <><Hourglass size={14} weight="fill" className="text-gold-dark" /> <span className="text-gold-dark">Waiting for your teacher</span></>}
          {result.is_correct === true && <><CheckCircle size={14} weight="fill" className="text-emerald-600" /> <span className="text-emerald-700">Marked correct</span></>}
          {result.is_correct === false && <><XCircle size={14} weight="fill" className="text-red-500" /> <span className="text-red-dark">Not quite</span></>}
        </p>
        <p className="text-sm text-ink-strong whitespace-pre-line break-words">{result.text || <em className="text-ink-muted">No answer given.</em>}</p>
      </div>
      {result.feedback && (
        <p className="flex gap-2 text-sm rounded-xl px-4 py-3 bg-bg-soft text-ink">
          <ChatCircleText size={18} weight="duotone" className="text-gold-dark flex-shrink-0 mt-0.5" />
          <span><strong className="text-ink-strong">Feedback:</strong> <span className="whitespace-pre-line">{result.feedback}</span></span>
        </p>
      )}
      {result.model_answer && (
        <p className="flex gap-2 text-sm rounded-xl px-4 py-3 bg-emerald-50/70 text-emerald-950">
          <Lightbulb size={18} weight="duotone" className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <span><strong>A good answer:</strong> <span className="whitespace-pre-line">{result.model_answer}</span></span>
        </p>
      )}
    </div>
  );
}
