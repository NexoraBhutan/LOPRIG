import { useState } from "react";
import { Link } from "react-router-dom";
import { FaEnvelope, FaArrowLeft } from "react-icons/fa";
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
    <div className="auth-page page-enter">
      <div className="auth-card card-plain">
        <Link to="/" className="auth-logo"><Logo /></Link>

        {sent ? (
          <div className="auth-success">
            <Mascot pose="celebrate" size={80} className="success-mascot" />
            <h1>Check your email</h1>
            <p className="auth-sub">We've sent password reset instructions to <strong>{email}</strong>.</p>
            <Link to="/login" className="btn btn-primary btn-block" style={{ marginTop: 24 }}>Back to Log In</Link>
          </div>
        ) : (
          <>
            <h1>Forgot password?</h1>
            <p className="auth-sub">Enter your email and we'll send you instructions to reset your password.</p>
            <form onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <div className="input-wrap">
                  <FaEnvelope size={15} />
                  <input id="email" type="email" className="has-icon" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-block btn-lg">Send Reset Link</button>
            </form>
            <Link to="/login" className="auth-back"><FaArrowLeft size={13} /> Back to log in</Link>
          </>
        )}
      </div>
    </div>
  );
}
