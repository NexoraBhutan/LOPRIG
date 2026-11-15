"use client";

import Link from "next/link";
import { BookOpen, Certificate, ChatsCircle, Clock, Prohibit, UserCircle, Warning } from "@phosphor-icons/react";
import { MIN_WATCH_HOURS, RULES, RULES_UPDATED } from "@/lib/rules";

const ICONS = [Clock, Prohibit, UserCircle, Certificate, ChatsCircle, Warning];

/** Rules and Regulations for students and lesson videos. Accepted before every enrollment. */
export default function Rules() {
  return (
    <main className="overflow-x-hidden w-full max-w-full px-5 sm:px-8 lg:px-16 pt-36 pb-32 md:pb-40 aw-gold-wash">
      <div className="max-w-[860px] mx-auto">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-dark">For every student</p>
        <h1 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong mt-3">Rules and Regulations</h1>
        <p className="text-ink-muted text-lg mt-4 max-w-[640px]">
          Lop-rig&apos;s lessons are made by Bhutanese teachers for students like you. These rules keep them fair, safe and
          available to everyone. You accept them each time you enroll in a course.
        </p>

        {/* The three rules students most need to know, up front. */}
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-10 list-none p-0">
          {[
            { icon: Clock, title: `Watch at least ${MIN_WATCH_HOURS} hour`, text: "Accounts that stop watching may be locked." },
            { icon: Prohibit, title: "No screen recording", text: "Lesson videos must never be recorded or filmed." },
            { icon: BookOpen, title: "No sharing", text: "Videos, links and materials are for you alone." },
          ].map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-2xl bg-ink-strong text-white p-5">
              <Icon size={26} weight="duotone" className="text-gold" />
              <p className="font-semibold mt-3">{title}</p>
              <p className="text-sm text-white/65 mt-1">{text}</p>
            </li>
          ))}
        </ul>

        <ol className="mt-12 flex flex-col gap-5 list-none p-0">
          {RULES.map((section, i) => {
            const Icon = ICONS[i] ?? BookOpen;
            return (
              <li key={section.title} className="bg-white border-2 border-line rounded-2xl p-6 md:p-7">
                <h2 className="flex items-center gap-3 font-semibold text-ink-strong text-lg">
                  <span className="w-10 h-10 rounded-xl bg-gold-soft text-gold-dark flex items-center justify-center flex-shrink-0">
                    <Icon size={20} weight="duotone" />
                  </span>
                  <span>{i + 1}. {section.title}</span>
                </h2>
                <ul className="mt-4 flex flex-col gap-2.5 pl-1">
                  {section.points.map((point) => (
                    <li key={point} className="flex gap-3 text-ink leading-relaxed">
                      <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>

        <div className="mt-10 rounded-2xl border-2 border-gold/40 bg-gold-soft/50 p-6 text-sm text-ink">
          <p>
            By ticking <strong className="text-ink-strong">&ldquo;I have read and accept the Rules and Regulations&rdquo;</strong> when you enroll,
            you agree to follow these rules for that course. Questions? Ask your teacher in the lesson comments or contact Lop-rig.
          </p>
          <p className="text-xs text-ink-muted mt-3">Last updated {RULES_UPDATED}.</p>
        </div>

        <Link href="/courses" className="btn btn-primary btn-lg mt-8 inline-flex">Browse courses</Link>
      </div>
    </main>
  );
}
