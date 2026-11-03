"use client";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { crm } from "@/lib/crmApi";

export default function AdminSignupForm({ next }: { next: string }) {
  const [f, setF] = useState({ name: "", email: "", password: "", passcode: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.password.length < 10) return setError("Admin passwords must be at least 10 characters.");
    setBusy(true);
    setError("");
    try {
      await crm.signup({ name: f.name.trim(), email: f.email.trim(), password: f.password, passcode: f.passcode });
      // Full navigation: the CRM has its own root layout.
      window.location.href = next;
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
        <span>Full Name</span>
        <input autoComplete="name" required maxLength={120} placeholder="e.g. Alex Morgan" value={f.name} onChange={set("name")} />
      </label>
      <label className="auth-field">
        <span>Email Address</span>
        <input type="email" autoComplete="email" required placeholder="admin@idle4ex.com" value={f.email} onChange={set("email")} />
      </label>
      <label className="auth-field">
        <span>Password</span>
        <span className="auth-pw">
          <input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={10}
            placeholder="At least 10 characters"
            value={f.password}
            onChange={set("password")}
          />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>
      <label className="auth-field">
        <span>Admin Security Passcode</span>
        <input type="password" autoComplete="off" required placeholder="Provided by the firm owner" value={f.passcode} onChange={set("passcode")} />
      </label>
      <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
        {busy ? "Creating account…" : "Create Admin Account"}
      </button>
    </form>
  );
}
