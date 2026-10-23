import type { ReactNode } from "react";

/** Label + control + hint/error, matching the student site's form styling. */
export default function Field({
  id,
  label,
  hint,
  error,
  children,
  className = "",
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-xs font-bold text-ink-strong uppercase tracking-wider">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-dark">{error}</p>
      ) : (
        hint && <p className="text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  );
}
