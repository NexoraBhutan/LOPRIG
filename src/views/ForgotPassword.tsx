"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Envelope, ArrowLeft } from "@phosphor-icons/react";
import Logo from "@/components/Logo";
import Mascot from "@/components/Mascot";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSent(true);
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

            {sent ? (
              <div className="text-center bg-white border-2 border-line rounded-2xl p-8 md:p-10">
                <Mascot pose="celebrate" size={80} className="mx-auto mb-4" />
                <h1 className="font-display text-3xl tracking-tight font-semibold text-ink-strong mb-2">Check your email</h1>
                <p className="text-sm text-ink-muted mb-8">We&apos;ve sent password reset instructions to <strong>{email}</strong>.</p>
                <Link href="/login" className="btn btn-primary btn-lg btn-block text-center">
                  Back to Log In
                </Link>
              </div>
            ) : (
              <>
                <h1 className="font-display text-3xl md:text-4xl tracking-tight font-semibold text-ink-strong mb-2">Forgot password?</h1>
                <p className="text-sm text-ink-muted mb-8">Enter your email and we&apos;ll send you a reset link.</p>

                <form onSubmit={onSubmit} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="email" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Email</label>
                    <div className="relative">
                      <Envelope size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-line rounded-xl text-sm text-ink-strong placeholder:text-ink-muted focus:border-gold focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-lg btn-block">Send Reset Link</button>
                </form>

                <Link href="/login" className="flex items-center justify-center gap-2 mt-7 text-sm font-bold text-gold-dark hover:text-gold transition-colors no-underline">
                  <ArrowLeft size={14} weight="bold" /> Back to Log In
                </Link>
              </>
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