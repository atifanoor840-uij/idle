"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, LogOut, Monitor, ShieldCheck, Smartphone } from "lucide-react";
import { sessions } from "@/lib/mock-pages";
import { btnPrimary, btnSecondary, Card, cx } from "@/components/portal/ui";
import { Badge, Field, inputCls, PageHeader, Tabs, Toggle } from "@/components/portal/kit";

type Tab = "security" | "notifications" | "preferences";

const NOTIFS = [
  { key: "payouts", title: "Payout updates", text: "When a payout is approved, sent or rejected." },
  { key: "objectives", title: "Objective alerts", text: "When you hit a profit target or get close to a loss limit." },
  { key: "breach", title: "Breach warnings", text: "Instant email if an account breaches a rule." },
  { key: "offers", title: "Offers & discounts", text: "Coupon codes and limited-time promotions." },
  { key: "news", title: "High-impact news", text: "A heads-up 15 minutes before red-folder events." },
];

export default function SettingsView() {
  const [tab, setTab] = useState<Tab>("security");
  const [twoFA, setTwoFA] = useState(false);
  const [pw, setPw] = useState({ cur: "", next: "", confirm: "" });
  const [pwSaved, setPwSaved] = useState(false);
  const [notifs, setNotifs] = useState<Record<string, boolean>>({ payouts: true, objectives: true, breach: true, offers: false, news: true });
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [saved, setSaved] = useState(false);

  useEffect(() => setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light"), []);

  const applyTheme = (t: "light" | "dark") => {
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
    try {
      localStorage.setItem("portal-theme", t);
    } catch {}
  };

  const pwError = pw.next && pw.next.length < 8 ? "Use at least 8 characters." : pw.confirm && pw.next !== pw.confirm ? "Passwords don't match." : "";
  const pwReady = pw.cur && pw.next.length >= 8 && pw.next === pw.confirm;

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" sub="Security, notifications and display preferences." />
      <Tabs
        tabs={[
          { key: "security", label: "Security" },
          { key: "notifications", label: "Notifications" },
          { key: "preferences", label: "Preferences" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "security" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card title="Change password">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!pwReady) return;
                setPw({ cur: "", next: "", confirm: "" });
                setPwSaved(true);
                setTimeout(() => setPwSaved(false), 2000);
              }}
            >
              <Field label="Current password">
                <input type="password" autoComplete="current-password" className={inputCls} value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} />
              </Field>
              <Field label="New password" hint={pwError || "At least 8 characters."}>
                <input type="password" autoComplete="new-password" className={inputCls} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </Field>
              <Field label="Confirm new password">
                <input type="password" autoComplete="new-password" className={inputCls} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
              </Field>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={!pwReady} className={btnPrimary}>
                  Update password
                </button>
                {pwSaved && (
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-success">
                    <CheckCircle2 size={16} /> Password updated
                  </span>
                )}
              </div>
            </form>
          </Card>

          <div className="space-y-5">
            <Card title="Two-factor authentication">
              <div className="flex items-start gap-4">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                  <ShieldCheck size={20} strokeWidth={1.75} />
                </span>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-ink">Authenticator app</p>
                  <p className="text-[13px] text-muted">Ask for a 6-digit code on every login and payout request.</p>
                  <div className="mt-2">
                    <Badge tone={twoFA ? "success" : "neutral"}>{twoFA ? "Enabled" : "Off"}</Badge>
                  </div>
                </div>
                <Toggle checked={twoFA} onChange={setTwoFA} label="Two-factor authentication" />
              </div>
            </Card>

            <Card title="Active sessions">
              <ul className="divide-y divide-line">
                {sessions.map((s) => (
                  <li key={s.device} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    {s.device.includes("iPhone") ? <Smartphone size={20} className="text-muted" /> : <Monitor size={20} className="text-muted" />}
                    <div className="flex-1">
                      <p className="text-[14px] font-semibold text-ink">{s.device}</p>
                      <p className="text-[12.5px] text-muted">
                        {s.location} · {s.lastActive}
                      </p>
                    </div>
                    {s.current ? <Badge tone="success">This device</Badge> : <button type="button" className="text-[13px] font-medium text-danger hover:underline">Revoke</button>}
                  </li>
                ))}
              </ul>
              <button type="button" className={cx(btnSecondary, "mt-5")}>
                <LogOut size={16} /> Sign out of all other sessions
              </button>
            </Card>
          </div>
        </div>
      )}

      {tab === "notifications" && (
        <Card title="Email notifications">
          <ul className="divide-y divide-line">
            {NOTIFS.map((n) => (
              <li key={n.key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="text-[14px] font-semibold text-ink">{n.title}</p>
                  <p className="text-[13px] text-muted">{n.text}</p>
                </div>
                <Toggle checked={notifs[n.key]} onChange={(v) => setNotifs({ ...notifs, [n.key]: v })} label={n.title} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === "preferences" && (
        <Card title="Display & region">
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <Field label="Language">
              <select className={inputCls} defaultValue="English">
                {["English", "Español", "العربية", "اردو"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Timezone">
              <select className={inputCls} defaultValue="GMT+5">
                {["GMT", "GMT+1", "GMT+4", "GMT+5", "GMT-5"].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </Field>
            <Field label="Theme" className="sm:col-span-2">
              <div className="grid grid-cols-2 gap-2">
                {(["light", "dark"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => applyTheme(t)}
                    aria-pressed={theme === t}
                    className={cx(
                      "h-11 rounded-tile border text-[14px] font-semibold capitalize transition",
                      theme === t ? "border-ink bg-surface-2 text-ink" : "border-line text-ink-2 hover:border-muted"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button type="button" onClick={flash} className={btnPrimary}>
              Save preferences
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-success">
                <CheckCircle2 size={16} /> Saved
              </span>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
