import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Envelope, Lock, Eye, EyeSlash, ArrowRight } from "@phosphor-icons/react";
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
    <main className="overflow-x-hidden w-full max-w-full">
      <section className="min-h-[100dvh] grid grid-cols-1 lg:grid-cols-2">
        {/* Image side */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative hidden lg:flex flex-col justify-end p-16 overflow-hidden bg-ink-strong order-1"
        >
          <img src="https://picsum.photos/seed/signupstart/1000/1400" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale contrast-125" />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(26,26,26,0.9)_0%,transparent_60%),radial-gradient(ellipse_at_20%_0%,rgba(255,182,6,0.2)_0%,transparent_55%)]" />
          <div className="relative">
            <p className="font-display text-3xl xl:text-4xl font-medium text-white leading-tight tracking-tight max-w-[480px]">
              Free to join. Certified when you finish.
            </p>
            <Link to="/about" className="inline-flex items-center gap-2 mt-6 text-sm font-bold uppercase tracking-widest text-gold hover:text-gold-light transition-colors">
              Why Lop-rig <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        </motion.div>

        {/* Form side */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-center px-8 py-24 bg-bg-soft order-2"
        >
          <div className="w-full max-w-[460px]">
            <div className="mb-8">
              <Link to="/" className="inline-block"><Logo /></Link>
            </div>

            <h1 className="font-display text-3xl md:text-4xl tracking-tight font-semibold text-ink-strong mb-2">Create your account</h1>
            <p className="text-sm text-ink-muted mb-8">Free to join. Enroll in your first course in a couple of minutes.</p>

            {error && <div id="signup-error" role="alert" className="bg-red-soft text-red text-sm font-medium p-3 rounded-lg mb-6">{error}</div>}

            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <div>
                <label htmlFor="name" className="block text-xs font-bold text-ink-strong uppercase tracking-wider mb-2">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input id="name" name="name" placeholder="Tshering Dema" value={form.name} onChange={onChange} required aria-describedby={error ? "signup-error" : undefined}
                    className="w-full bg-white border-2 border-line rounded-lg py-3 pl-11 pr-4 text-sm outline-none focus:border-gold transition-colors" />
                </div>
              </div>
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-ink-strong uppercase tracking-wider mb-2">Email</label>
                <div className="relative">
                  <Envelope size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={onChange} required
                    className="w-full bg-white border-2 border-line rounded-lg py-3 pl-11 pr-4 text-sm outline-none focus:border-gold transition-colors" />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="block text-xs font-bold text-ink-strong uppercase tracking-wider mb-2">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input id="password" name="password" type={showPw ? "text" : "password"} placeholder="Create a password" value={form.password} onChange={onChange} required
                    className="w-full bg-white border-2 border-line rounded-lg py-3 pl-11 pr-11 text-sm outline-none focus:border-gold transition-colors" />
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
                    className="w-full bg-white border-2 border-line rounded-lg py-3 pl-11 pr-4 text-sm outline-none focus:border-gold transition-colors" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" checked={agree} onChange={() => setAgree((a) => !a)} className="w-4 h-4 accent-gold rounded" />
                <span>I agree to the Terms and Conditions</span>
              </label>

              <button type="submit" className="btn btn-primary btn-lg btn-block mt-2">
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

            <p className="text-sm text-ink-muted mt-6">
              Already have an account? <Link to="/login" className="font-bold text-gold-dark hover:text-gold transition-colors">Log in</Link>
            </p>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
