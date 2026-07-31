import { useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Sparkles } from "lucide-react";
import Brand from "./Brand";
import { api } from "../lib/api";

const benefits = [
  "Answers grounded in your authorized sources",
  "Page-level citations on every response",
  "Private workspaces with audit-ready controls",
];

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("register");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    organization_name: "",
    full_name: "",
    email: "",
    password: "",
  });

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = mode === "register"
        ? await api.register(form)
        : await api.login(form.email, form.password);
      localStorage.setItem("verity_token", result.access_token);
      onAuthenticated(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-story-inner">
          <Brand />
          <div className="auth-copy">
            <div className="eyebrow"><Sparkles size={14} /> Company intelligence, verified</div>
            <h1>Every answer.<br /><em>Backed by evidence.</em></h1>
            <p>
              Turn scattered policies, contracts, and playbooks into one secure source of truth
              your team can actually trust.
            </p>
            <div className="benefit-list">
              {benefits.map((benefit) => (
                <div className="benefit" key={benefit}>
                  <span><Check size={14} strokeWidth={3} /></span>{benefit}
                </div>
              ))}
            </div>
          </div>
          <div className="trust-note">
            <LockKeyhole size={16} /> Designed for confidential company knowledge
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand"><Brand /></div>
          <p className="auth-kicker">{mode === "register" ? "Start your workspace" : "Welcome back"}</p>
          <h2>{mode === "register" ? "Build a source of truth" : "Sign in to VerityAI"}</h2>
          <p className="auth-subtitle">
            {mode === "register" ? "Create your secure organization in under a minute." : "Continue to your knowledge workspace."}
          </p>

          <div className="auth-tabs" role="tablist">
            <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button>
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
          </div>

          <form onSubmit={submit}>
            {mode === "register" && (
              <div className="field-row">
                <label>Organization<input name="organization_name" value={form.organization_name} onChange={update} placeholder="Northstar & Co." required minLength={2} /></label>
                <label>Your name<input name="full_name" value={form.full_name} onChange={update} placeholder="Amina Shah" required minLength={2} /></label>
              </div>
            )}
            <label>Work email<input type="email" name="email" value={form.email} onChange={update} placeholder="you@company.com" required /></label>
            <label>
              Password
              <span className="password-field">
                <input type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={update} placeholder={mode === "register" ? "At least 10 characters" : "Your password"} required minLength={10} />
                <button type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </span>
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button auth-submit" disabled={submitting}>
              {submitting ? "Preparing workspace…" : mode === "register" ? "Create secure workspace" : "Continue to workspace"}
              {!submitting && <ArrowRight size={17} />}
            </button>
          </form>
          <p className="terms">By continuing, you agree to responsible use and data handling policies.</p>
        </div>
      </section>
    </main>
  );
}
