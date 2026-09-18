import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
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
    push("Account created — welcome!", "success");
    navigate("/dashboard");
  };

  return (
    <div className="auth-page page-enter">
      <div className="auth-card card-plain">
        <Link to="/" className="auth-logo"><Logo /></Link>
        <h1>Create your account</h1>
        <p className="auth-sub">Free to join — enroll in your first course in a couple of minutes.</p>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="name">Full Name</label>
            <div className="input-wrap">
              <FaUser size={15} />
              <input id="name" name="name" className="has-icon" placeholder="Tshering Dema" value={form.name} onChange={onChange} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <div className="input-wrap">
              <FaEnvelope size={15} />
              <input id="email" name="email" type="email" className="has-icon" placeholder="you@example.com" value={form.email} onChange={onChange} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <FaLock size={15} />
              <input id="password" name="password" type={showPw ? "text" : "password"} className="has-icon" placeholder="Create a password" value={form.password} onChange={onChange} required />
              <button type="button" className="input-eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
              </button>
            </div>
            {form.password && (
              <div className="pw-strength">
                <div className="pw-strength-track">
                  <div className={`pw-strength-fill strength-${strength}`} style={{ width: `${(strength / 4) * 100}%` }} />
                </div>
                <span>{LABELS[strength]}</span>
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm Password</label>
            <div className="input-wrap">
              <FaLock size={15} />
              <input id="confirm" name="confirm" type={showPw ? "text" : "password"} className="has-icon" placeholder="Re-enter your password" value={form.confirm} onChange={onChange} required />
            </div>
          </div>

          <label className="filter-check" style={{ marginBottom: 20 }}>
            <input type="checkbox" checked={agree} onChange={() => setAgree((a) => !a)} />
            <span>I agree to the Terms and Conditions</span>
          </label>

          <button type="submit" className="btn btn-primary btn-block btn-lg">Create Account</button>
        </form>

        <div className="auth-divider"><span>OR</span></div>
        <button className="btn btn-secondary btn-block" type="button" onClick={() => push("Google sign-in is a demo placeholder.", "info")}>
          Continue with Google
        </button>

        <p className="auth-footer">Already have an account? <Link to="/login">Log in</Link></p>
      </div>
    </div>
  );
}
