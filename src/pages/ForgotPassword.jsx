import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Envelope, ArrowLeft } from "@phosphor-icons/react";
import Logo from "../components/Logo";
import Mascot from "../components/Mascot";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = (e) => {
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
              <Link to="/" className="inline-block"><Logo /></Link>
            </div>

            {sent ? (
              <div className="text-center bg-white border-2 border-line rounded-2xl p-8 md:p-10">
                <Mascot pose="celebrate" size={80} className="mx-auto mb-4" />
                <h1 className="font-display text-3xl tracking-tight font-semibold text-ink-strong mb-2">Check your email</h1>
                <p className="text-sm text-ink-muted mb-8">We&apos;ve sent password reset instructions to <strong>{email}</strong>.</p>
                <Link to="/login" className="btn btn-primary btn-lg btn-block text-center">
                  Back to Log In
                </Link>
              </div>
            ) : (
              <div className="bg-white border-2 border-line rounded-2xl p-8 md:p-10">
                <h1 className="font-display text-3xl tracking-tight font-semibold text-ink-strong mb-2">Forgot password?</h1>
                <p className="text-sm text-ink-muted mb-8">Enter your email and we&apos;ll send you instructions to reset your password.</p>
                <form onSubmit={onSubmit} className="flex flex-col gap-5">
                  <div>
                    <label htmlFor="email" className="block text-xs font-bold text-ink-strong uppercase tracking-wider mb-2">Email</label>
                    <div className="relative">
                      <Envelope size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                      <input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required
                        className="w-full bg-bg-soft border-2 border-line rounded-lg py-3 pl-11 pr-4 text-sm outline-none focus:border-gold transition-colors" />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-lg btn-block">
                    Send Reset Link
                  </button>
                </form>
                <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-gold-dark hover:text-gold transition-colors mt-6">
                  <ArrowLeft size={13} /> Back to log in
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        {/* Image side */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative hidden lg:flex flex-col justify-end p-16 overflow-hidden bg-ink-strong"
        >
          <img src="https://picsum.photos/seed/resetkey/1000/1400" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale contrast-125" />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(26,26,26,0.9)_0%,transparent_60%),radial-gradient(ellipse_at_80%_0%,rgba(255,182,6,0.2)_0%,transparent_55%)]" />
          <p className="relative font-display text-3xl xl:text-4xl font-medium text-white leading-tight tracking-tight max-w-[480px]">
            Locked out for a minute, learning for a lifetime.
          </p>
        </motion.div>
      </section>
    </main>
  );
}
