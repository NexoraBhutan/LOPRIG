import { CheckCircle, Circle } from "@phosphor-icons/react";
import { STRENGTH_COLORS, STRENGTH_LABELS, passwordChecks, passwordStrength } from "@/lib/password";

/** Strength bar + live checklist under a "new password" field. */
export default function PasswordStrength({ password, email, id = "password-rules" }: { password: string; email: string; id?: string }) {
  const strength = passwordStrength(password, email);
  return (
    <div className="flex flex-col gap-2.5">
      {password && (
        <div className="flex items-center gap-3" aria-live="polite">
          <div className="flex gap-1.5 flex-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < strength ? STRENGTH_COLORS[strength] : "bg-line"}`} />
            ))}
          </div>
          <span className="text-xs font-bold text-ink-muted w-16 text-right">{STRENGTH_LABELS[strength]}</span>
        </div>
      )}
      <ul id={id} className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 list-none p-0 m-0">
        {passwordChecks(password, email).map((c) => (
          <li key={c.label} className={`flex items-center gap-2 text-xs transition-colors ${c.ok ? "text-emerald-700" : "text-ink-muted"}`}>
            {c.ok ? <CheckCircle size={15} weight="fill" /> : <Circle size={15} />} {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
