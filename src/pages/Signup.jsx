import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Envelope, Lock, Eye, EyeSlash } from "@phosphor-icons/react";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

function getStrength(pw) {
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
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");

  const strength = useMemo(() => getStrength(form.password), [form.password]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    if (!agree) return setError("Please agree to the Terms and Conditions.");
    const res = signup(form);
    if (!res.ok) return setError(res.error);
    push("Account created. Welcome!", "success");
    navigate("/dashboard");
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
          <h1 className="text-2xl font-semibold text-ink-strong mb-2">Create your account</h1>
          <p className="text-sm text-ink-muted mb-8">Free to join. Enroll in your first course in a couple of minutes.</p>

          {error && <div id="signup-error" role="alert" className="bg-red-soft text-red text-sm font-medium p-3 rounded-lg mb-6">{error}</div>}

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="name" className="block text-xs font-bold text-ink-strong uppercase tracking-wider mb-2">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input id="name" name="name" placeholder="Tshering Dema" value={form.name} onChange={onChange} required aria-describedby={error ? "signup-error" : undefined}
                  className="w-full bg-bg-soft border-2 border-line rounded-lg py-3 pl-11 pr-4 text-sm outline-none focus:border-gold transition-colors" />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-ink-strong uppercase tracking-wider mb-2">Email</label>
              <div className="relative">
                <Envelope size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={onChange} required
                  className="w-full bg-bg-soft border-2 border-line rounded-lg py-3 pl-11 pr-4 text-sm outline-none focus:border-gold transition-colors" />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-ink-strong uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input id="password" name="password" type={showPw ? "text" : "password"} placeholder="Create a password" value={form.password} onChange={onChange} required
                  className="w-full bg-bg-soft border-2 border-line rounded-lg py-3 pl-11 pr-11 text-sm outline-none focus:border-gold transition-colors" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-strong transition-colors bg-transparent border-none cursor-pointer p-1" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}>
                  {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.password && (
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex-1 h-1.5 bg-bg-sunken rounded-full overflow-hidden flex gap-0.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={`flex-1 rounded-full transition-colors ${i < strength ? STRENGTH_COLORS[strength - 1] : "bg-bg-sunken"}`} />
                    ))}
                  </div>
                  <span className="text-xs text-ink-muted">{LABELS[strength]}</span>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="confirm" className="block text-xs font-bold text-ink-strong uppercase tracking-wider mb-2">Confirm Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input id="confirm" name="confirm" type={showPw ? "text" : "password"} placeholder="Re-enter your password" value={form.confirm} onChange={onChange} required
                  className="w-full bg-bg-soft border-2 border-line rounded-lg py-3 pl-11 pr-4 text-sm outline-none focus:border-gold transition-colors" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="checkbox" checked={agree} onChange={() => setAgree((a) => !a)} className="w-4 h-4 accent-gold rounded" />
              <span>I agree to the Terms and Conditions</span>
            </label>

            <button type="submit" className="btn btn-primary btn-block mt-2">
              Create Account
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
          Already have an account? <Link to="/login" className="font-bold text-gold-dark hover:text-gold transition-colors">Log in</Link>
        </p>
      </motion.div>
    </main>
  );
}
