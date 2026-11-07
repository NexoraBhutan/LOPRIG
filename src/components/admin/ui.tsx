"use client";

import type { ReactNode } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import UserAvatar from "@/components/UserAvatar";

/** Small building blocks shared by the admin portal pages. */

export function PageHeader({ eyebrow, title, description, action }: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        {eyebrow && <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-gold-dark mb-2">{eyebrow}</p>}
        <h1 className="font-display text-3xl md:text-4xl tracking-tighter font-semibold text-ink-strong">{title}</h1>
        {description && <p className="text-sm text-ink-muted mt-2 max-w-[640px]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function FilterChips<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-4 py-2 rounded-full text-sm font-medium border-2 border-solid cursor-pointer transition-colors ${
            value === o.value ? "bg-ink-strong text-white border-ink-strong" : "bg-white text-ink border-line hover:border-gold"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full sm:w-72">
      <span className="sr-only">{placeholder}</span>
      <MagnifyingGlass size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-11 pr-4 py-2.5 bg-white border-2 border-line rounded-full text-sm text-ink-strong placeholder:text-ink-muted focus:border-gold focus:outline-none transition-colors"
      />
    </label>
  );
}

export function Pill({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.7rem] font-bold uppercase tracking-wider whitespace-nowrap ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export function Card({ title, description, action, children, className = "" }: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white border-2 border-line rounded-2xl p-6 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            {title && <h2 className="font-display text-xl font-semibold text-ink-strong">{title}</h2>}
            {description && <p className="text-sm text-ink-muted mt-0.5">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Simple, accessible bar chart (no chart library). Each bar has a tooltip with its exact value. */
export function BarChart({ data, format = (v) => String(v), summary }: {
  data: { label: string; value: number }[];
  format?: (value: number) => string;
  summary: string;
}) {
  const peak = Math.max(...data.map((d) => d.value), 0) || 1;
  return (
    <div>
      <div className="flex items-end gap-[3px] h-36" role="img" aria-label={summary}>
        {data.map((d) => (
          <div key={d.label} className="group relative flex-1 h-full flex items-end rounded-md bg-bg-soft" title={`${d.label}: ${format(d.value)}`}>
            <span
              className="block w-full rounded-md bg-gradient-to-t from-gold-dark to-gold transition-all duration-500 group-hover:from-ink-strong group-hover:to-ink"
              style={{ height: `${Math.max(d.value ? 4 : 0, (100 * d.value) / peak)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-ink-muted">
        <span>{data[0]?.label}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

export function TableShell({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  return (
    <div className="bg-white border-2 border-line rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-bg-soft">
            <tr className="text-left text-[0.7rem] font-bold uppercase tracking-wider text-ink-muted">
              {head.map((h) => <th key={h} scope="col" className="px-5 py-3 whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">{children}</tbody>
        </table>
      </div>
      {empty && <p className="p-8 text-center text-sm text-ink-muted">{empty}</p>}
    </div>
  );
}

export function LoadMore({ shown, total, hasMore, loading, onClick }: {
  shown: number; total: number; hasMore: boolean; loading: boolean; onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm text-ink-muted">
      <span>Showing {shown} of {total}</span>
      {hasMore && (
        <button onClick={onClick} disabled={loading} className="btn btn-md btn-outline-neutral disabled:opacity-60">
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

export function Avatar({ name, color, src }: { name: string; color?: string; src?: string }) {
  return <UserAvatar name={name} color={color} src={src} />;
}
