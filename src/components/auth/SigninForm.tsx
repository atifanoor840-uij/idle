"use client";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/propApi";
import { crm } from "@/lib/crmApi";

export default function SigninForm({ next, notice, mode = "trader" }: { next: string; notice?: string; mode?: "trader" | "admin" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "admin") await crm.signin(email.trim(), password);
      else await api.auth.signin(email.trim(), password);
      // Full navigation: the portal has its own root layout.
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={submit} noValidate={false}>
      {notice && <p className="auth-msg ok" role="status">{notice}</p>}
      {error && (
        <p className="auth-msg err" role="alert">
          {error}
        </p>
      )}
      <label className="auth-field">
        <span>Email</span>
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="auth-field">
        <span>Password</span>
        <span className="auth-pw">
          <input type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>
      <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
