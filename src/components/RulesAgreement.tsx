"use client";

import Link from "next/link";
import { ArrowSquareOut, ShieldCheck } from "@phosphor-icons/react";

/** "I accept the Rules and Regulations": required before a student can enroll in any course. */
export default function RulesAgreement({ checked, onChange, error, className = "" }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Shown when the student tries to continue without ticking. */
  error?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border-2 p-4 transition-colors ${
        checked ? "border-emerald-300 bg-emerald-50/60" : error ? "border-red-dark bg-red-soft/60" : "border-line bg-white"
      } ${className}`}
    >
      <label className="flex items-start gap-3 cursor-pointer text-sm text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-5 h-5 accent-gold cursor-pointer flex-shrink-0"
          aria-describedby="rules-agreement-hint"
          aria-invalid={error && !checked}
        />
        <span>
          I have read and accept Lop-rig&apos;s{" "}
          <Link href="/rules" target="_blank" className="inline-flex items-center gap-1 font-bold text-gold-dark hover:text-gold">
            Rules and Regulations <ArrowSquareOut size={12} weight="bold" />
          </Link>
          , including the minimum watch time and the ban on screen recording and sharing lesson videos.
        </span>
      </label>
      <p id="rules-agreement-hint" className={`flex items-center gap-1.5 mt-2 ml-8 text-xs ${checked ? "text-emerald-700" : error ? "text-red-dark" : "text-ink-muted"}`}>
        <ShieldCheck size={13} weight={checked ? "fill" : "regular"} />
        {checked ? "Thank you. You can continue." : error ? "Please tick to accept the rules before you continue." : "You need to accept the rules to enroll."}
      </p>
    </div>
  );
}
