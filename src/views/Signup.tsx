"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { User, Envelope, Lock, Eye, EyeSlash, ArrowRight } from "@phosphor-icons/react";
import Logo from "@/components/Logo";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

function getStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}
const LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = ["bg-red", "bg-orange-400", "bg-yellow-400", "bg-blue-400", "bg-emerald-500"];

export default function Signup() {
  const { signup } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");

  const strength = useMemo(() => getStrength(form.password), [form.password]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (!agree) return setError("Please agree to the Terms and Conditions.");
    const res = await signup({ name: form.name, email: form.email, password: form.password });
    if (!res.ok) return setError(res.error);
    push("Account created. Welcome!", "success");
    router.push("/dashboard");
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <section className="min-h-[100dvh] grid grid-cols-1 lg:grid-cols-2">
        {/* Visual side */}
        <div className="relative hidden lg:block bg-ink-strong overflow-hidden aw-grain">
          <img
            src="https://picsum.photos/seed/signupbg/1200/1600"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale contrast-125"
          />
          <div className="absolute inset-0 aw-dark-wash" />
          <div className="relative h-full flex flex-col justify-end p-16">
            <blockquote className="max-w-[420px]">
              <p className="font-display text-2xl leading-snug text-white font-medium">
                &ldquo;Join 2,400+ learners building real skills across Bhutan.&rdquo;
              </p>
              <footer className="text-white/50 text-sm mt-5">Free to start · Certificate on completion</footer>
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

            <h1 className="font-display text-3xl md:text-4xl tracking-tight font-semibold text-ink-strong mb-2">Create your account</h1>
            <p className="text-sm text-ink-muted mb-8">Free forever. Start learning in minutes.</p>

            <GoogleSignInButton text="signup_with" onError={setError} />

            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="name" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Full name</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                  <input
                    id="name"
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={onChange}
                    placeholder="Your name"
                    required
                    className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-line rounded-xl text-sm text-ink-strong placeholder:text-ink-muted focus:border-gold focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Email</label>
                <div className="relative">
                  <Envelope size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={onChange}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-line rounded-xl text-sm text-ink-strong placeholder:text-ink-muted focus:border-gold focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="password" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={onChange}
                    placeholder="At least 8 characters"
                    required
                    minLength={6}
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
                {form.password.length > 0 && (
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex gap-1.5 flex-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < strength ? STRENGTH_COLORS[strength - 1] : "bg-line"}`} />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-ink-muted">{LABELS[strength]}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="confirm" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Confirm password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                  <input
                    id="confirm"
                    type={showPw ? "text" : "password"}
                    name="confirm"
                    value={form.confirm}
                    onChange={onChange}
                    placeholder="Re-enter your password"
                    required
                    className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-line rounded-xl text-sm text-ink-strong placeholder:text-ink-muted focus:border-gold focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-ink-muted cursor-pointer">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="w-4 h-4 accent-gold mt-0.5" required />
                <span>I agree to the <Link href="/about" className="font-bold text-gold-dark hover:text-gold no-underline">Terms and Conditions</Link> and <Link href="/about" className="font-bold text-gold-dark hover:text-gold no-underline">Privacy Policy</Link>.</span>
              </label>

              {error && (
                <div role="alert" className="rounded-xl bg-red-soft text-red px-5 py-3.5 text-sm font-medium">{error}</div>
              )}

              <button type="submit" className="btn btn-primary btn-lg btn-block mt-1">
                Create Account <ArrowRight size={14} weight="bold" />
              </button>
            </form>

            <p className="text-sm text-ink-muted text-center mt-7">
              Already have an account?{" "}
              <Link href="/login" className="font-bold text-gold-dark hover:text-gold transition-colors no-underline">Log in</Link>
            </p>
          </div>
        </motion.div>
      </section>
    </main>
  );
}