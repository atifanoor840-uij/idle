"use client";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/propApi";

export default function SignupForm({ referralCode: initialRef, collaboratorCode }: { referralCode: string; collaboratorCode: string }) {
  const [f, setF] = useState({ name: "", email: "", password: "", country: "", phone: "", referralCode: initialRef });
  const [show, setShow] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    setError("");
    try {
      const res = await api.auth.signup({
        name: f.name.trim(),
        email: f.email.trim(),
        password: f.password,
        country: f.country.trim(),
        phone: f.phone.trim(),
        referralCode: f.referralCode.trim() || undefined,
        collaboratorCode: collaboratorCode || undefined,
      });
      window.location.href = res.verificationPage || `/auth/verify-email?email=${encodeURIComponent(f.email.trim())}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed.");
      setBusy(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      {error && (
        <p className="auth-msg err" role="alert">
          {error}
        </p>
      )}
      <label className="auth-field">
        <span>Full name</span>
        <input autoComplete="name" required maxLength={120} value={f.name} onChange={set("name")} />
      </label>
      <label className="auth-field">
        <span>Email</span>
        <input type="email" autoComplete="email" required value={f.email} onChange={set("email")} />
      </label>
      <label className="auth-field">
        <span>Password</span>
        <span className="auth-pw">
          <input type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={128} value={f.password} onChange={set("password")} aria-describedby="pw-hint" />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
        <small id="pw-hint">At least 8 characters.</small>
      </label>
      <div className="auth-row">
        <label className="auth-field">
          <span>Country</span>
          <input autoComplete="country-name" required value={f.country} onChange={set("country")} />
        </label>
        <label className="auth-field">
          <span>
            Phone <em>(optional)</em>
          </span>
          <input type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} />
        </label>
      </div>
      <label className="auth-field">
        <span>
          Referral code <em>(optional)</em>
        </span>
        <input value={f.referralCode} onChange={set("referralCode")} />
      </label>
      <label className="auth-check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
        <span>
          I am 18+ and agree to the <a href="/terms" target="_blank">Terms of Service</a>, <a href="/privacy" target="_blank">Privacy Policy</a> and{" "}
          <a href="/risk-disclosure" target="_blank">Risk Disclosure</a>.
        </span>
      </label>
      <button type="submit" className="btn btn-primary auth-submit" disabled={busy || !agree}>
        {busy ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
