"use client";

import { useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import PasswordStrength from "@/components/PasswordStrength";
import Field from "@/components/teach/Field";
import { api, errorMessage } from "@/lib/api";
import { isAcceptable } from "@/lib/password";
import { fieldErrors, inputClass } from "@/lib/teach";

const EMPTY = { current_password: "", new_password: "", confirm: "" };

/** Current password + a new one (with strength meter). Used on Profile and Teach → Account. */
export default function ChangePasswordForm({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void }) {
  const { user, refreshUser } = useAuth();
  const { push } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const mismatch = form.confirm.length > 0 && form.confirm !== form.new_password;
  const sameAsOld = form.new_password.length > 0 && form.new_password === form.current_password;
  const canSave = Boolean(form.current_password) && isAcceptable(form.new_password, user.email)
    && form.confirm === form.new_password && !sameAsOld;

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setErrors({});
    setSaving(true);
    try {
      await api("/users/me/password/", {
        method: "POST",
        body: { current_password: form.current_password, new_password: form.new_password },
      });
      await refreshUser();
      setForm(EMPTY);
      push("Password updated. Use your new password next time you log in.", "success");
      onDone?.();
    } catch (err) {
      setErrors(fieldErrors(err));
      push(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const type = show ? "text" : "password";

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Field id="current-password" label="Current password" error={errors.current_password}>
        <input id="current-password" type={type} autoComplete="current-password" value={form.current_password} onChange={set("current_password")} className={inputClass} required />
      </Field>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="new-password" className="text-xs font-bold text-ink-strong uppercase tracking-wider">New password</label>
          <button type="button" onClick={() => setShow((s) => !s)} className="flex items-center gap-1.5 text-xs font-bold text-ink-muted hover:text-ink-strong bg-transparent border-none cursor-pointer">
            {show ? <EyeSlash size={15} /> : <Eye size={15} />} {show ? "Hide" : "Show"} passwords
          </button>
        </div>
        <input id="new-password" type={type} autoComplete="new-password" value={form.new_password} onChange={set("new_password")} className={inputClass} aria-describedby="password-rules" required />
        <PasswordStrength password={form.new_password} email={user.email} />
        {sameAsOld && <p role="alert" className="text-xs text-red-dark">Pick a password different from the current one.</p>}
        {errors.new_password && <p role="alert" className="text-xs text-red-dark">{errors.new_password}</p>}
      </div>

      <Field id="confirm-password" label="Confirm new password" error={mismatch ? "Passwords don't match." : undefined}>
        <input id="confirm-password" type={type} autoComplete="new-password" value={form.confirm} onChange={set("confirm")} className={inputClass} required />
      </Field>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={!canSave || saving} className="btn btn-md btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? "Saving…" : "Update password"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving} className="btn btn-md btn-outline-neutral">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
