"use client";

import { useState } from "react";
import { Eye, EyeSlash, ShieldCheck } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import PasswordStrength from "@/components/PasswordStrength";
import Field from "@/components/teach/Field";
import { Card, PageHeader } from "@/components/admin/ui";
import { api, errorMessage } from "@/lib/api";
import { isAcceptable } from "@/lib/password";
import { fieldErrors, inputClass } from "@/lib/teach";

const EMPTY = { current_password: "", new_password: "", confirm: "" };

export default function TeachAccount() {
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
    } catch (err) {
      setErrors(fieldErrors(err));
      push(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const type = show ? "text" : "password";

  return (
    <div className="flex flex-col gap-6 max-w-[760px]">
      <PageHeader eyebrow="Settings" title="Account" description="Your login details. Only you know your password; admins can't see it." />

      <Card title="Profile">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-ink-muted">Name</dt>
            <dd className="mt-1 font-semibold text-ink-strong">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-ink-muted">Login email</dt>
            <dd className="mt-1 font-semibold text-ink-strong break-all">{user.email}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Password" description="Choose a strong password that you don't use on any other website.">
        <div role="status" className="flex gap-3 p-4 mb-6 rounded-xl bg-emerald-50 text-emerald-800 text-sm">
          <ShieldCheck size={22} weight="fill" className="text-emerald-600 shrink-0" />
          <p>You&apos;ve set your own password. You can change it again any time.</p>
        </div>

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

          <button type="submit" disabled={!canSave || saving} className="btn btn-md btn-primary self-start disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? "Saving…" : "Update password"}
          </button>
        </form>
      </Card>
    </div>
  );
}
