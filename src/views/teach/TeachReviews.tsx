"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CaretRight, CheckCircle, Exam, Hourglass, XCircle } from "@phosphor-icons/react";
import PageLoader from "@/components/PageLoader";
import EmptyState from "@/components/EmptyState";
import UserAvatar from "@/components/UserAvatar";
import { api, errorMessage } from "@/lib/api";
import { timeAgo, type ReviewSummary } from "@/lib/teach";

/** Chapter quizzes with written answers: the ones waiting to be marked, then recently marked ones. */
export default function TeachReviews() {
  const [data, setData] = useState<{ pending: ReviewSummary[]; reviewed: ReviewSummary[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ pending: ReviewSummary[]; reviewed: ReviewSummary[] }>("/teach/reviews/")
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <EmptyState title="Couldn't load reviews" description={error} ctaLabel="Try again" ctaOnClick={() => location.reload()} />;
  if (!data) return <PageLoader />;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-gold-dark mb-2">Chapter quizzes</p>
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-ink-strong">Reviews</h1>
        <p className="text-ink-muted mt-2 max-w-[640px]">
          Students&apos; written answers land here. Mark each answer and add a short note: they get their score and your
          feedback by notification and email straight away.
        </p>
      </header>

      <section aria-labelledby="pending-heading" className="bg-white border-2 border-line rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-line bg-bg-soft">
          <Hourglass size={18} weight="duotone" className="text-gold-dark" />
          <h2 id="pending-heading" className="flex-1 font-semibold text-ink-strong">Waiting for you</h2>
          <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-ink-strong tabular-nums">{data.pending.length}</span>
        </div>
        {data.pending.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle size={36} weight="duotone" className="mx-auto text-emerald-500" />
            <p className="mt-3 font-semibold text-ink-strong">All caught up</p>
            <p className="text-sm text-ink-muted mt-1">
              When a student submits written answers, they&apos;ll appear here and you&apos;ll get an email.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {data.pending.map((a) => <ReviewRow key={a.id} attempt={a} />)}
          </ul>
        )}
      </section>

      {data.reviewed.length > 0 && (
        <section aria-labelledby="reviewed-heading" className="bg-white border-2 border-line rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-line bg-bg-soft">
            <Exam size={18} weight="duotone" className="text-ink-muted" />
            <h2 id="reviewed-heading" className="flex-1 font-semibold text-ink-strong">Recently marked</h2>
          </div>
          <ul className="divide-y divide-line">
            {data.reviewed.map((a) => <ReviewRow key={a.id} attempt={a} />)}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReviewRow({ attempt: a }: { attempt: ReviewSummary }) {
  const pending = a.status === "PENDING";
  return (
    <li>
      <Link href={`/teach/reviews/${a.id}`} className="group flex items-center gap-4 px-6 py-4 no-underline hover:bg-bg-soft/60 transition-colors">
        <UserAvatar name={a.student.name} src={a.student.avatar} className="w-10 h-10 text-sm" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-ink-strong truncate group-hover:text-gold-dark transition-colors">
            {a.student.name}
          </span>
          <span className="block text-xs text-ink-muted truncate">
            {a.quiz} · {a.course.title}
          </span>
          <span className="block text-xs text-ink-muted mt-0.5">
            {a.written_count} written {a.written_count === 1 ? "answer" : "answers"} · sent {timeAgo(a.submitted_at)}
          </span>
        </span>
        {pending ? (
          <span className="hidden sm:inline-flex btn btn-sm btn-primary pointer-events-none">Mark answers</span>
        ) : (
          <span className={`inline-flex items-center gap-1 text-xs font-bold ${a.passed ? "text-emerald-600" : "text-red-dark"}`}>
            {a.passed ? <CheckCircle size={14} weight="fill" /> : <XCircle size={14} weight="fill" />}
            {a.score}% · {a.passed ? "Passed" : "Not passed"}
          </span>
        )}
        <CaretRight size={14} className="text-ink-muted flex-shrink-0" />
      </Link>
    </li>
  );
}
