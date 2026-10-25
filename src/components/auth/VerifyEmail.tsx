"use client";
import { useState } from "react";
import { api } from "@/lib/propApi";

export default function VerifyEmail({ status, email: initialEmail }: { status: string; email: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<"" | "sending" | "sent" | "failed">("");

  if (status === "success") {
    return (
      <div className="auth-form">
        <a href="/dashboard" className="btn btn-primary auth-submit">
          Go to dashboard
        </a>
      </div>
    );
  }

  const resend = async () => {
    setState("sending");
    try {
      await api.auth.resendVerification(email.trim());
      setState("sent");
    } catch {
      setState("failed");
    }
  };

  return (
    <div className="auth-form">
      {state === "sent" && <p className="auth-msg ok" role="status">If an unverified account exists for this email, a new link is on its way.</p>}
      {state === "failed" && <p className="auth-msg err" role="alert">We couldn&apos;t send the email right now. Please try again shortly.</p>}
      <label className="auth-field">
        <span>Email Address</span>
        <input
          type="email"
          autoComplete="email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <button type="button" onClick={resend} disabled={!email || state === "sending"} className="btn btn-outline auth-submit">
        {state === "sending" ? "Sending…" : "Resend verification email"}
      </button>
      <a href="/auth/signin" className="auth-alt">
        Back to sign in
      </a>
    </div>
  );
}
