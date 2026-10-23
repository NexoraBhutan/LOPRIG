"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Envelope, ArrowLeft, Lock, Eye, EyeSlash } from "@phosphor-icons/react";
import Logo from "@/components/Logo";
import Mascot from "@/components/Mascot";
import { ApiError, api, errorMessage } from "@/lib/api";

type Step = "email" | "code" | "done";

const RESEND_SECONDS = 60;
const inputClass =
  "w-full pl-11 pr-4 py-3.5 bg-white border-2 border-line rounded-xl text-sm text-ink-strong placeholder:text-ink-muted focus:border-gold focus:outline-none transition-colors";

/** First message for `field` from a DRF validation error, if any. */
function fieldError(err: unknown, field: string): string | undefined {
  if (!(err instanceof ApiError) || !err.data || typeof err.data !== "object") return undefined;
  const value = (err.data as Record<string, unknown>)[field];
  if (typeof value === "string") return value; // DRF sends single messages as a plain string
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : undefined;
}

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<{ form?: string; code?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    setErrors({});
    setBusy(true);
    try {
      // Succeeds for any well-formed email, so this page can't be used to find out who has an account.
      await api("/auth/password-reset/", { method: "POST", body: { email } });
      setStep("code");
      setCode("");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const onEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) sendCode();
  };

  const onResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (password !== confirm) return setErrors({ password: "Passwords do not match." });
    if (password.length < 8) return setErrors({ password: "Use at least 8 characters." });
    setBusy(true);
    try {
      await api("/auth/password-reset/confirm/", { method: "POST", body: { email, code, new_password: password } });
      setStep("done");
    } catch (err) {
      const codeError = fieldError(err, "code");
      const passwordError = fieldError(err, "new_password");
      setErrors(codeError || passwordError ? { code: codeError, password: passwordError } : { form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <section className="min-h-[100dvh] grid grid-cols-1 lg:grid-cols-2">
        {/* Form side */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-center px-8 py-24 bg-bg-soft"
        >
          <div className="w-full max-w-[460px]">
            <div className="mb-8">
              <Link href="/" className="inline-block"><Logo /></Link>
            </div>

            {step === "done" && (
              <div className="text-center bg-white border-2 border-line rounded-2xl p-8 md:p-10">
                <Mascot pose="celebrate" size={80} className="mx-auto mb-4" />
                <h1 className="font-display text-3xl tracking-tight font-semibold text-ink-strong mb-2">Password updated</h1>
                <p className="text-sm text-ink-muted mb-8">
                  You can now log in with your new password. For your safety, you&apos;ve been signed out on other devices.
                </p>
                <Link href="/login" className="btn btn-primary btn-lg btn-block text-center">Log In</Link>
              </div>
            )}

            {step === "email" && (
              <>
                <h1 className="font-display text-3xl md:text-4xl tracking-tight font-semibold text-ink-strong mb-2">Forgot password?</h1>
                <p className="text-sm text-ink-muted mb-8">Enter your email and we&apos;ll send you a 6-digit code.</p>

                <form onSubmit={onEmailSubmit} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="email" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Email</label>
                    <div className="relative">
                      <Envelope size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className={inputClass}
                      />
                    </div>
                  </div>
                  {errors.form && <p role="alert" className="text-sm text-red">{errors.form}</p>}
                  <button type="submit" disabled={busy} className="btn btn-primary btn-lg btn-block disabled:opacity-60">
                    {busy ? "Sending…" : "Send Code"}
                  </button>
                </form>
              </>
            )}

            {step === "code" && (
              <>
                <h1 className="font-display text-3xl md:text-4xl tracking-tight font-semibold text-ink-strong mb-2">Check your email</h1>
                <p className="text-sm text-ink-muted mb-8">
                  If an account exists for <strong className="text-ink-strong">{email}</strong>, we&apos;ve sent a 6-digit code.
                  It expires in 10 minutes.
                </p>

                <form onSubmit={onResetSubmit} className="flex flex-col gap-5" noValidate>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="code" className="text-xs font-bold text-ink-strong uppercase tracking-wider">6-digit code</label>
                    <input
                      id="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••••"
                      aria-invalid={Boolean(errors.code)}
                      aria-describedby={errors.code ? "code-error" : undefined}
                      className="w-full px-4 py-4 bg-white border-2 border-line rounded-xl text-center font-display text-2xl font-semibold tracking-[0.5em] text-ink-strong placeholder:text-line-strong focus:border-gold focus:outline-none transition-colors"
                    />
                    {errors.code && <p id="code-error" role="alert" className="text-sm text-red">{errors.code}</p>}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="new-password" className="text-xs font-bold text-ink-strong uppercase tracking-wider">New password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                      <input
                        id="new-password"
                        type={showPw ? "text" : "password"}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className={`${inputClass} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-strong bg-transparent border-none cursor-pointer p-1"
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="confirm-password" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Confirm new password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                      <input
                        id="confirm-password"
                        type={showPw ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    {errors.password && <p role="alert" className="text-sm text-red">{errors.password}</p>}
                  </div>

                  {errors.form && <p role="alert" className="text-sm text-red">{errors.form}</p>}
                  <button type="submit" disabled={busy || code.length !== 6} className="btn btn-primary btn-lg btn-block disabled:opacity-60">
                    {busy ? "Saving…" : "Reset Password"}
                  </button>
                </form>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-6 text-sm">
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={cooldown > 0 || busy}
                    className="font-bold text-gold-dark hover:text-gold bg-transparent border-none cursor-pointer p-0 disabled:text-ink-muted disabled:cursor-not-allowed"
                  >
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStep("email"); setErrors({}); }}
                    className="text-ink-muted hover:text-ink-strong bg-transparent border-none cursor-pointer p-0"
                  >
                    Use a different email
                  </button>
                </div>
              </>
            )}

            {step !== "done" && (
              <Link href="/login" className="flex items-center justify-center gap-2 mt-7 text-sm font-bold text-gold-dark hover:text-gold transition-colors no-underline">
                <ArrowLeft size={14} weight="bold" /> Back to Log In
              </Link>
            )}
          </div>
        </motion.div>

        {/* Visual side */}
        <div className="relative hidden lg:block bg-ink-strong overflow-hidden aw-grain">
          <img
            src="https://picsum.photos/seed/resetbg/1200/1600"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale contrast-125"
          />
          <div className="absolute inset-0 aw-dark-wash" />
          <div className="relative h-full flex items-center justify-center p-16">
            <Mascot pose="thinking" size={260} className="relative" />
          </div>
        </div>
      </section>
    </main>
  );
}
