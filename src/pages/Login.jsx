import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Envelope, Lock, Eye, EyeSlash } from "@phosphor-icons/react";
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
          <h1 className="text-2xl font-semibold text-ink-strong mb-2">Welcome back</h1>
          <p className="text-sm text-ink-muted mb-8">Log in to continue your learning journey.</p>

          {error && <div id="login-error" role="alert" className="bg-red-soft text-red text-sm font-medium p-3 rounded-lg mb-6">{error}</div>}

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-ink-strong uppercase tracking-wider mb-2">Email</label>
              <div className="relative">
                <Envelope size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={onChange} required aria-describedby={error ? "login-error" : undefined}
                  className="w-full bg-bg-soft border-2 border-line rounded-lg py-3 pl-11 pr-4 text-sm outline-none focus:border-gold transition-colors" />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-ink-strong uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input id="password" name="password" type={showPw ? "text" : "password"} placeholder="••••••••" value={form.password} onChange={onChange} required
                  className="w-full bg-bg-soft border-2 border-line rounded-lg py-3 pl-11 pr-11 text-sm outline-none focus:border-gold transition-colors" />
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

            <button type="submit" className="btn btn-primary btn-block mt-2">
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
        </div>

        <p className="text-center text-sm text-ink-muted mt-6">
          Don&apos;t have an account? <Link to="/signup" className="font-bold text-gold-dark hover:text-gold transition-colors">Sign up</Link>
        </p>
      </motion.div>
    </main>
  );
}
