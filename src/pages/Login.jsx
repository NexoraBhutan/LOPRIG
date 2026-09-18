import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
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
    if (!res.ok) {
      setError(res.error);
      return;
    }
    push("Welcome back!", "success");
    navigate(location.state?.from || "/dashboard");
  };

  return (
    <div className="auth-page page-enter">
      <div className="auth-card card-plain">
        <Link to="/" className="auth-logo"><Logo /></Link>
        <h1>Welcome back</h1>
        <p className="auth-sub">Log in to continue your learning journey.</p>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={onSubmit}>
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
              <input id="password" name="password" type={showPw ? "text" : "password"} className="has-icon" placeholder="••••••••" value={form.password} onChange={onChange} required />
              <button type="button" className="input-eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
              </button>
            </div>
          </div>

          <div className="auth-row">
            <label className="filter-check" style={{ padding: 0 }}>
              <input type="checkbox" checked={remember} onChange={() => setRemember((r) => !r)} />
              <span>Remember me</span>
            </label>
            <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg">Log In</button>
        </form>

        <div className="auth-divider"><span>OR</span></div>
        <button className="btn btn-secondary btn-block" type="button" onClick={() => push("Google sign-in is a demo placeholder.", "info")}>
          Continue with Google
        </button>

        <p className="auth-footer">Don't have an account? <Link to="/signup">Sign up</Link></p>
      </div>
    </div>
  );
}
