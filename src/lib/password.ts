/** Password rules and strength meter for the teacher Account page. */

const COMMON = ["password", "12345678", "qwerty", "letmein", "welcome", "iloveyou", "admin", "loprig"];

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

/** The rules shown as a live checklist (the server checks them again). */
export function passwordChecks(pw: string, email = ""): PasswordCheck[] {
  const lower = pw.toLowerCase();
  const local = email.split("@")[0].toLowerCase();
  const guessable = COMMON.some((c) => lower.includes(c)) || (local.length >= 3 && lower.includes(local)) || /^\d+$/.test(pw);
  return [
    { label: "At least 8 characters", ok: pw.length >= 8 },
    { label: "Upper and lower case letters", ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { label: "At least one number", ok: /[0-9]/.test(pw) },
    { label: "Not a common word or your email", ok: pw.length > 0 && !guessable },
  ];
}

export const STRENGTH_LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
export const STRENGTH_COLORS = ["bg-red", "bg-orange-400", "bg-yellow-400", "bg-blue-400", "bg-emerald-500"];

/** 0–4. Passing every check gives "Good"; 12+ characters or a symbol on top makes it "Strong". */
export function passwordStrength(pw: string, email = ""): number {
  if (!pw) return 0;
  const passed = passwordChecks(pw, email).filter((c) => c.ok).length;
  if (passed < 4) return Math.max(passed - 1, 0);
  return pw.length >= 12 || /[^A-Za-z0-9]/.test(pw) ? 4 : 3;
}

/** True when every checklist rule passes. */
export function isAcceptable(pw: string, email = ""): boolean {
  return passwordChecks(pw, email).every((c) => c.ok);
}

// The temporary password the user just logged in with, kept in memory only (never stored),
// so the "Set your password" page doesn't ask them to type it a second time.
let pendingTemporary = "";

export function rememberTemporaryPassword(pw: string): void {
  pendingTemporary = pw;
}

export function peekTemporaryPassword(): string {
  return pendingTemporary;
}

export function forgetTemporaryPassword(): void {
  pendingTemporary = "";
}
