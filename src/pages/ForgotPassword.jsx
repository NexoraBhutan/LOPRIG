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
    <main className="min-h-[100dvh] flex items-center justify-center px-8 py-32 bg-bg-soft">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[460px]"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-block"><Logo /></Link>
        </div>

        <div className="bg-white border-2 border-line rounded-xl p-8 md:p-10">
          {sent ? (
            <div className="text-center">
              <Mascot pose="celebrate" size={80} className="mx-auto mb-4" />
              <h1 className="text-2xl font-semibold text-ink-strong mb-2">Check your email</h1>
              <p className="text-sm text-ink-muted mb-8">We&apos;ve sent password reset instructions to <strong>{email}</strong>.</p>
              <Link to="/login" className="btn btn-primary btn-block text-center">
                Back to Log In
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-ink-strong mb-2">Forgot password?</h1>
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
                <button type="submit" className="btn btn-primary btn-block">
                  Send Reset Link
                </button>
              </form>
              <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-gold-dark hover:text-gold transition-colors mt-6">
                <ArrowLeft size={13} /> Back to log in
              </Link>
            </>
          )}
        </div>
      </motion.div>
    </main>
  );
}
