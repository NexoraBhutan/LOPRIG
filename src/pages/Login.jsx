import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Envelope, Lock, Eye, EyeSlash, ArrowRight } from "@phosphor-icons/react";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function Login() {
  const { login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(true);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    const res = login(form);
    if (!res.ok) { setError(res.error); return; }
    push("Welcome back!", "success");
    navigate(location.state?.from || "/dashboard");
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <section className="min-h-[100dvh] grid grid-cols-1 lg:grid-cols-2">
        {/* Form side */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-center px-8 py-32 bg-bg-soft"
        >
          <div className="w-full max-w-[460px]">
            <div className="mb-8">
              <Link to="/" className="inline-block"><Logo /></Link>
            </div>

            <h1 className="font-display text-3xl md:text-4xl tracking-tight font-semibold text-ink-strong mb-2">Welcome back</h1>
            <p className="text-sm text-ink-muted mb-8">Log in to continue your learning journey.</p>

            {error && <div id="login-error" role="alert" className="bg-red-soft text-red text-sm font-medium p-3 rounded-lg mb-6">{error}</div>}

            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-ink-strong uppercase tracking-wider mb-2">Email</label>
                <div className="relative">
                  <Envelope size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={onChange} required aria-describedby={error ? "login-error" : undefined}
                    className="w-full bg-white border-2 border-line rounded-lg py-3 pl-11 pr-4 text-sm outline-none focus:border-gold transition-colors" />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="block text-xs font-bold text-ink-strong uppercase tracking-wider mb-2">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input id="password" name="password" type={showPw ? "text" : "password"} placeholder="••••••••" value={form.password} onChange={onChange} required
                    className="w-full bg-white border-2 border-line rounded-lg py-3 pl-11 pr-11 text-sm outline-none focus:border-gold transition-colors" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-strong transition-colors bg-transparent border-none cursor-pointer p-1" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}>
                    {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                  <input type="checkbox" checked={remember} onChange={() => setRemember((r) => !r)} className="w-4 h-4 accent-gold rounded" />
                  <span>Remember me</span>
                </label>
                <Link to="/forgot-password" className="text-sm font-bold text-gold-dark hover:text-gold transition-colors">Forgot password?</Link>
              </div>

              <button type="submit" className="btn btn-primary btn-lg btn-block mt-2">
                Log In
              </button>
            </form>

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-line" />
              <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">OR</span>
              <div className="flex-1 h-px bg-line" />
            </div>

            <button className="btn btn-secondary btn-block" type="button" onClick={() => push("Google sign-in is a demo placeholder.", "info")}>
              Continue with Google
            </button>

            <p className="text-sm text-ink-muted mt-6">
              Don&apos;t have an account? <Link to="/signup" className="font-bold text-gold-dark hover:text-gold transition-colors">Sign up</Link>
            </p>
          </div>
        </motion.div>

        {/* Image side */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative hidden lg:flex flex-col justify-end p-16 overflow-hidden bg-ink-strong"
        >
          <img src="https://picsum.photos/seed/loginfocus/1000/1400" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale contrast-125" />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(26,26,26,0.9)_0%,transparent_60%),radial-gradient(ellipse_at_80%_0%,rgba(255,182,6,0.2)_0%,transparent_55%)]" />
          <div className="relative">
            <p className="font-display text-3xl xl:text-4xl font-medium text-white leading-tight tracking-tight max-w-[480px]">
              Pick up exactly where you left off.
            </p>
            <Link to="/courses" className="inline-flex items-center gap-2 mt-6 text-sm font-bold uppercase tracking-widest text-gold hover:text-gold-light transition-colors">
              Browse the catalog <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
