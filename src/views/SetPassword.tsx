"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Check, Eye, EyeSlash, Key, Lock, ShieldCheck, SignOut, X } from "@phosphor-icons/react";
import Logo from "@/components/Logo";
import Mascot from "@/components/Mascot";
import PasswordStrength from "@/components/PasswordStrength";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, errorMessage } from "@/lib/api";
import { forgetTemporaryPassword, isAcceptable, peekTemporaryPassword } from "@/lib/password";
import { fieldErrors } from "@/lib/teach";
import { homeFor } from "@/utils/routes";

const inputClass =
  "w-full pl-11 pr-12 py-3.5 bg-white border-2 border-line rounded-xl text-sm text-ink-strong placeholder:text-ink-muted focus:border-gold focus:outline-none transition-colors";

const STEPS = ["Log in", "Set password", "Start"];
const PORTAL_LABEL: Record<string, string> = { TEACHER: "teacher portal", ADMIN: "admin portal", STUDENT: "dashboard" };
const TIPS = [
  "Use 12 or more characters; a short phrase is easy to remember.",
  "Don't reuse a password from another website.",
  "Never share it. Lop-rig staff will never ask for your password.",
  "Forgot it later? Use “Forgot password?” on the login page.",
];

/** First login with an emailed temporary password: the user must choose their own before anything else. */
export default function SetPassword() {
  const { user, ready, refreshUser, logout } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  // Filled in from the login form (memory only), so they don't type the temporary password twice.
  const [temporary, setTemporary] = useState(() => peekTemporaryPassword());
  const [askTemporary, setAskTemporary] = useState(() => !peekTemporaryPassword());
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (!user.mustChangePassword && !done) router.replace(homeFor(user.role));
  }, [ready, user, done, router]);

  useEffect(() => forgetTemporaryPassword, []);

  if (!ready || !user || (!user.mustChangePassword && !done)) return null;

  const firstName = user.name.split(" ")[0];
  const matches = confirm.length > 0 && confirm === password;
  const sameAsTemporary = password.length > 0 && password === temporary;
  const canSave = Boolean(temporary) && isAcceptable(password, user.email) && matches && !sameAsTemporary;
  const type = show ? "text" : "password";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setErrors({});
    setSaving(true);
    try {
      await api("/users/me/password/", { method: "POST", body: { current_password: temporary, new_password: password } });
      forgetTemporaryPassword();
      setDone(true);
      await refreshUser();
    } catch (err) {
      const errs = fieldErrors(err);
      if (errs.current_password) {
        setAskTemporary(true);
        errs.current_password = "That isn't the temporary password from your newest Lop-rig email.";
      }
      setErrors(errs);
      if (!errs.current_password && !errs.new_password) push(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <section className="min-h-[100dvh] grid grid-cols-1 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-center px-6 sm:px-8 py-14 bg-bg-soft"
        >
          <div className="w-full max-w-[480px]">
            <div className="mb-8"><Logo /></div>

            <ol className="flex items-center gap-2 mb-8 list-none p-0" aria-label="Account setup progress">
              {STEPS.map((label, i) => {
                const current = done ? 2 : 1;
                const state = i < current ? "done" : i === current ? "current" : "todo";
                return (
                  <li key={label} className="flex items-center gap-2 flex-1 last:flex-none" aria-current={state === "current" ? "step" : undefined}>
                    <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                      state === "done" ? "bg-emerald-500 text-white" : state === "current" ? "bg-gold text-ink-strong" : "bg-line text-ink-muted"
                    }`}>
                      {state === "done" ? <Check size={14} weight="bold" /> : i + 1}
                    </span>
                    <span className={`text-xs font-bold whitespace-nowrap ${state === "todo" ? "text-ink-muted" : "text-ink-strong"}`}>{label}</span>
                    {i < STEPS.length - 1 && <span className={`h-0.5 flex-1 rounded-full ${state === "done" ? "bg-emerald-500" : "bg-line"}`} />}
                  </li>
                );
              })}
            </ol>

            {done ? (
              <div className="text-center bg-white border-2 border-line rounded-2xl p-8 md:p-10">
                <Mascot pose="celebrate" size={84} className="mx-auto mb-4" />
                <h1 className="font-display text-3xl tracking-tight font-semibold text-ink-strong mb-2">You&apos;re all set, {firstName}!</h1>
                <p className="text-sm text-ink-muted mb-2">Your password is saved and the temporary one no longer works.</p>
                <p className="text-sm text-ink-muted mb-8">
                  Next time, log in with <strong className="text-ink-strong break-all">{user.email}</strong> and your new password.
                </p>
                <button onClick={() => router.replace(homeFor(user.role))} className="btn btn-primary btn-lg btn-block">
                  Go to your {PORTAL_LABEL[user.role] ?? "dashboard"} <ArrowRight size={16} weight="bold" />
                </button>
              </div>
            ) : (
              <>
                <h1 className="font-display text-3xl md:text-4xl tracking-tight font-semibold text-ink-strong mb-2">Set your own password</h1>
                <p className="text-sm text-ink-muted mb-6">
                  Welcome, {firstName}! You signed in with the temporary password from your email.
                  Choose a password only you know; you&apos;ll use it every time you log in.
                </p>

                <div className="flex items-center gap-3 p-3 mb-7 rounded-xl bg-white border-2 border-line">
                  <span className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-ink-strong bg-gold shrink-0" aria-hidden="true">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-strong truncate">{user.name}</span>
                    <span className="block text-xs text-ink-muted truncate">{user.email}</span>
                  </span>
                  <button onClick={signOut} className="flex items-center gap-1.5 text-xs font-bold text-ink-muted hover:text-ink-strong bg-transparent border-none cursor-pointer">
                    <SignOut size={14} weight="bold" /> Not you?
                  </button>
                </div>

                <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
                  {askTemporary ? (
                    <div className="flex flex-col gap-2">
                      <label htmlFor="temporary-password" className="text-xs font-bold text-ink-strong uppercase tracking-wider">
                        Temporary password (from your email)
                      </label>
                      <div className="relative">
                        <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                        <input
                          id="temporary-password" type={type} autoComplete="current-password" value={temporary}
                          onChange={(e) => setTemporary(e.target.value.trim())} className={inputClass}
                          aria-invalid={Boolean(errors.current_password)} placeholder="e.g. Kp7x-Qm2R-hT9w-3NeZ"
                        />
                      </div>
                      {errors.current_password && <p role="alert" className="text-xs text-red-dark">{errors.current_password}</p>}
                    </div>
                  ) : (
                    <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700 -mb-1">
                      <ShieldCheck size={16} weight="fill" /> Temporary password confirmed
                    </p>
                  )}

                  <div className="flex flex-col gap-2">
                    <label htmlFor="new-password" className="text-xs font-bold text-ink-strong uppercase tracking-wider">New password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                      <input
                        id="new-password" type={type} autoComplete="new-password" autoFocus value={password}
                        onChange={(e) => setPassword(e.target.value)} className={inputClass}
                        placeholder="At least 8 characters" aria-describedby="password-rules"
                      />
                      <button
                        type="button" onClick={() => setShow((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-strong bg-transparent border-none cursor-pointer p-1"
                        aria-label={show ? "Hide passwords" : "Show passwords"}
                      >
                        {show ? <EyeSlash size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <PasswordStrength password={password} email={user.email} />
                    {sameAsTemporary && <p role="alert" className="text-xs text-red-dark">Choose something different from the temporary password.</p>}
                    {errors.new_password && <p role="alert" className="text-xs text-red-dark">{errors.new_password}</p>}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="confirm-password" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Confirm new password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                      <input
                        id="confirm-password" type={type} autoComplete="new-password" value={confirm}
                        onChange={(e) => setConfirm(e.target.value)} className={inputClass}
                        aria-invalid={confirm.length > 0 && !matches}
                      />
                      {confirm && (
                        <span className={`absolute right-4 top-1/2 -translate-y-1/2 ${matches ? "text-emerald-600" : "text-red"}`} aria-hidden="true">
                          {matches ? <Check size={16} weight="bold" /> : <X size={16} weight="bold" />}
                        </span>
                      )}
                    </div>
                    {confirm && !matches && <p role="alert" className="text-xs text-red-dark">Passwords don&apos;t match yet.</p>}
                  </div>

                  <button type="submit" disabled={!canSave || saving} className="btn btn-primary btn-lg btn-block mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
                    {saving ? "Saving…" : <>Save password &amp; continue <ArrowRight size={16} weight="bold" /></>}
                  </button>
                </form>
              </>
            )}
          </div>
        </motion.div>

        <div className="relative hidden lg:flex bg-ink-strong overflow-hidden items-center justify-center p-16">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_10%,rgba(255,182,6,0.25)_0%,transparent_60%)]" />
          <div className="relative max-w-[420px] text-white">
            <Mascot pose={done ? "celebrate" : "thinking"} size={170} className="mb-8" />
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-gold mb-3">Keep your account safe</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white mb-6">A good password is long and yours alone</h2>
            <ul className="flex flex-col gap-3.5 list-none p-0 m-0 text-sm text-white/75">
              {TIPS.map((tip) => (
                <li key={tip} className="flex gap-3">
                  <Check size={16} weight="bold" className="text-gold shrink-0 mt-0.5" /> {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
