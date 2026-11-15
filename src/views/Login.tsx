"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Envelope, Lock, Eye, EyeSlash, ArrowRight } from "@phosphor-icons/react";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { API_URL } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { rememberTemporaryPassword } from "@/lib/password";
import { homeFor } from "@/utils/routes";
import GoogleSignInButton from "@/components/GoogleSignInButton";

import { photo } from "@/lib/photos";
/** Site administrators sign in to Django Admin on the API server, not here. */
const SITE_ADMIN_URL = `${API_URL.replace(/\/api\/v1$/, "")}/admin/`;

export default function Login() {
  const { login } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams?.get("from");
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [siteAdmin, setSiteAdmin] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (credentials: { email: string; password: string }) => {
    setError("");
    setSiteAdmin(false);
    const res = await login(credentials);
    if (!res.ok) {
      setSiteAdmin(res.code === "site_admin_account");
      return setError(res.error);
    }
    if (res.mustChangePassword) {
      // Logged in with the emailed temporary password: they choose their own before anything else.
      rememberTemporaryPassword(credentials.password);
      return router.replace("/set-password");
    }
    push("Welcome back.", "success");
    router.push(from || homeFor(res.role));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(form);
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <section className="min-h-[100dvh] grid grid-cols-1 lg:grid-cols-2">
        {/* Visual side */}
        <div className="relative hidden lg:block bg-ink-strong overflow-hidden aw-grain">
          <img
            src={photo("loginbg")}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale contrast-125"
          />
          <div className="absolute inset-0 aw-dark-wash" />
          <div className="relative h-full flex flex-col justify-end p-16">
            <blockquote className="max-w-[420px]">
              <p className="font-display text-2xl leading-snug text-white font-medium">
                &ldquo;Pick up where you left off — your learning streak and progress sync everywhere.&rdquo;
              </p>
              <footer className="text-white/50 text-sm mt-5">Continue your journey with Lop-rig</footer>
            </blockquote>
          </div>
        </div>

        {/* Form side */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-center px-8 py-32 bg-bg-soft"
        >
          <div className="w-full max-w-[460px]">
            <div className="mb-8">
              <Link href="/" className="inline-block"><Logo /></Link>
            </div>

            <h1 className="font-display text-3xl md:text-4xl tracking-tight font-semibold text-ink-strong mb-2">Welcome back</h1>
            <p className="text-sm text-ink-muted mb-8">Enter your credentials to continue your learning.</p>

            <GoogleSignInButton
              from={from}
              onError={(message, code) => {
                setSiteAdmin(code === "site_admin_account");
                setError(message);
              }}
            />

            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Email</label>
                <div className="relative">
                  <Envelope size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                  <input
                    id="email" type="email" name="email" value={form.email} onChange={onChange}
                    placeholder="you@example.com" required
                    className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-line rounded-xl text-sm text-ink-strong placeholder:text-ink-muted focus:border-gold focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="password" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                  <input
                    id="password" type={showPw ? "text" : "password"} name="password" value={form.password} onChange={onChange}
                    placeholder="Your password" required
                    className="w-full pl-11 pr-12 py-3.5 bg-white border-2 border-line rounded-xl text-sm text-ink-strong placeholder:text-ink-muted focus:border-gold focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-ink-muted hover:text-ink-strong transition-colors p-0"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="rounded-xl bg-red-soft text-red px-5 py-3.5 text-sm font-medium">
                  {error}
                  {siteAdmin && (
                    <a href={SITE_ADMIN_URL} className="block mt-2 font-bold text-red underline underline-offset-2">
                      Go to site administration →
                    </a>
                  )}
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-lg btn-block mt-1">
                Log In <ArrowRight size={14} weight="bold" />
              </button>
            </form>

            <div className="flex items-center justify-between mt-6 text-xs text-ink-muted">
              <Link href="/forgot-password" className="font-bold text-gold-dark hover:text-gold no-underline">Forgot password?</Link>
              <Link href="/signup" className="font-bold text-gold-dark hover:text-gold no-underline">Create account</Link>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
