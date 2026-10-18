"use client";
import { useState, type FormEvent } from "react";
import { BadgeCheck, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { api, ApiError, goToSignin, type Kyc } from "@/lib/propApi";
import { fmtDate, useApi } from "@/lib/portal-data";
import { useSessionUser } from "@/components/portal/SessionContext";
import { btnPrimary, btnSecondary, Card, cx, FormMessage, LoadState } from "@/components/portal/ui";
import { Badge, Field, inputCls, PageHeader } from "@/components/portal/kit";

const KYC_LABEL: Record<Kyc["status"], string> = { approved: "Approved", pending: "In review", needs_review: "In review", rejected: "Rejected" };

function ProfileForm() {
  const user = useSessionUser();
  const [f, setF] = useState({ name: user.name, phone: user.phone, country: user.country });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const dirty = f.name !== user.name || f.phone !== user.phone || f.country !== user.country;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return setMsg({ tone: "error", text: "Name can't be empty." });
    setBusy(true);
    setMsg(null);
    try {
      await api.auth.updateProfile({ name: f.name.trim(), phone: f.phone.trim(), country: f.country.trim() });
      setMsg({ tone: "success", text: "Profile saved." });
      // Header and greeting read the user from the server layout; refresh it.
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return goToSignin();
      setMsg({ tone: "error", text: err instanceof Error ? err.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Personal information">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input className={inputCls} autoComplete="name" maxLength={120} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Email" hint={user.emailVerified ? "Verified" : "Not verified yet — check your inbox"}>
            <input className={cx(inputCls, "bg-surface-2")} value={user.email} readOnly />
          </Field>
          <Field label="Phone">
            <input type="tel" className={inputCls} autoComplete="tel" maxLength={40} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Country">
            <input className={inputCls} autoComplete="country-name" maxLength={80} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
          </Field>
        </div>
        {msg && <FormMessage tone={msg.tone}>{msg.text}</FormMessage>}
        <button type="submit" disabled={!dirty || busy} className={btnPrimary}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>
    </Card>
  );
}

function KycCard() {
  const { data, error, loading, reload } = useApi(() => api.kyc.get());
  const [busy, setBusy] = useState<"" | "start" | "sync">("");
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const kyc = data?.kyc;
  const status = kyc?.status;

  const start = async () => {
    setBusy("start");
    setMsg(null);
    try {
      const r = await api.kyc.start();
      if (r.simulated) {
        setMsg({ tone: "info", text: "Verification provider is in test mode — no real check was started. Contact support to complete KYC." });
      } else if (r.kyc?.backUrl) {
        window.open(r.kyc.backUrl, "_blank", "noopener,noreferrer");
        setMsg({ tone: "info", text: "Verification opened in a new tab. Come back here and refresh the status when you're done." });
      }
      reload();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Could not start verification." });
    } finally {
      setBusy("");
    }
  };

  const sync = async () => {
    setBusy("sync");
    setMsg(null);
    try {
      await api.kyc.sync();
      reload();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Could not refresh the status." });
    } finally {
      setBusy("");
    }
  };

  return (
    <Card
      title="Identity verification (KYC)"
      actions={status ? <Badge tone={status === "approved" ? "success" : status === "rejected" ? "danger" : "warning"}>{KYC_LABEL[status]}</Badge> : undefined}
    >
      <LoadState loading={loading} error={error} onRetry={reload} rows={1} />
      {data && (
        <div className="space-y-4">
          {status === "approved" ? (
            <p className="flex items-center gap-2 text-[15px] text-ink">
              <BadgeCheck className="text-success" /> Your identity is verified. Payouts are unlocked.
            </p>
          ) : !data.isEligible ? (
            <p className="flex items-start gap-2 text-[14px] text-ink-2">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-muted" />
              Verification opens once you have a funded or Instant account. It takes about five minutes with a passport, ID card or driver&apos;s licence.
            </p>
          ) : (
            <>
              <p className="text-[14px] text-ink-2">
                {status === "rejected"
                  ? `Your last verification was rejected${kyc?.rejectReason ? `: ${kyc.rejectReason}` : "."} You can try again.`
                  : status
                    ? "Your verification is in progress. If you finished the steps, refresh the status."
                    : "Verify your identity with our partner Didit. You'll need a government ID and your phone camera."}
              </p>
              <div className="flex flex-wrap gap-2">
                {(!status || status === "rejected") && (
                  <button type="button" onClick={start} disabled={!!busy} className={btnPrimary}>
                    <ExternalLink size={16} /> {busy === "start" ? "Starting…" : "Start verification"}
                  </button>
                )}
                {status && status !== "rejected" && kyc?.backUrl?.startsWith("http") && (
                  <a href={kyc.backUrl} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
                    <ExternalLink size={16} /> Continue verification
                  </a>
                )}
                {status && (
                  <button type="button" onClick={sync} disabled={!!busy} className={btnSecondary}>
                    <RefreshCw size={16} className={cx(busy === "sync" && "animate-spin")} /> Refresh status
                  </button>
                )}
              </div>
            </>
          )}
          {kyc?.updatedAt && <p className="text-[12px] text-muted">Last updated {fmtDate(kyc.updatedAt)}</p>}
          {msg && <FormMessage tone={msg.tone}>{msg.text}</FormMessage>}
        </div>
      )}
    </Card>
  );
}

export default function ProfileView() {
  return (
    <div className="space-y-5">
      <PageHeader title="Profile & KYC" sub="Keep your details current. We verify every trader once before the first payout." />
      <ProfileForm />
      <KycCard />
    </div>
  );
}
