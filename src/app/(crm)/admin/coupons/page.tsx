"use client";
import { useState, type FormEvent } from "react";
import { crm, type AdminCoupon } from "@/lib/crmApi";
import { btnPrimary, Card, cx, FormMessage, LoadState } from "@/components/portal/ui";
import { Badge, Field, inputCls, PageHeader, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";
import { ConfirmAction, dangerLink, errMsg, fmtDateTime, linkBtn, useAdmin } from "@/components/crm/kit";

const state = (c: AdminCoupon) => (c.isExpired || (c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()) ? "Expired" : c.status === "active" ? "Active" : "Paused");

export default function CouponsAdmin() {
  const { data, error, loading, reload } = useAdmin(() => crm.coupons.list());
  const [f, setF] = useState({ code: "", pct: "", expires: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [del, setDel] = useState<AdminCoupon | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const code = f.code.trim().toUpperCase();
    const pct = Number(f.pct);
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return setMsg({ tone: "error", text: "Code: 3–30 letters, numbers, - or _." });
    if (!(pct > 0 && pct <= 100)) return setMsg({ tone: "error", text: "Discount must be between 1 and 100%." });
    setBusy(true);
    setMsg(null);
    try {
      await crm.coupons.save({ code, discountPercent: pct, status: "active", expiresAt: f.expires ? new Date(f.expires).toISOString() : undefined });
      setMsg({ tone: "success", text: `${code} saved — ${pct}% off.` });
      setF({ code: "", pct: "", expires: "" });
      reload();
    } catch (e) {
      setMsg({ tone: "error", text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c: AdminCoupon) => {
    setMsg(null);
    try {
      await crm.coupons.save({ code: c.code, discountPercent: Number(c.discountPercent), status: c.status === "active" ? "inactive" : "active", expiresAt: c.expiresAt });
      reload();
    } catch (e) {
      setMsg({ tone: "error", text: errMsg(e) });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Coupons" sub="Discount codes traders enter at checkout. Codes are private — they are never listed publicly." />
      <Card title="Create or update a coupon">
        <form onSubmit={save} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Code">
            <input className={cx(inputCls, "uppercase")} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="WELCOME10" />
          </Field>
          <Field label="Discount %">
            <input className={inputCls} type="number" min={1} max={100} value={f.pct} onChange={(e) => setF({ ...f, pct: e.target.value })} />
          </Field>
          <Field label="Expires (optional)">
            <input className={inputCls} type="datetime-local" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} />
          </Field>
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? "Saving…" : "Save coupon"}
          </button>
        </form>
        {msg && <div className="mt-4"><FormMessage tone={msg.tone}>{msg.text}</FormMessage></div>}
      </Card>

      <Card title="All coupons">
        <LoadState loading={loading} error={error} onRetry={reload} />
        {!loading && !error && (
          <div className={tableWrap}>
            <table className="w-full min-w-[640px] border-collapse">
              <thead className="bg-surface-2">
                <tr>
                  <th className={thCls}>Code</th>
                  <th className={thCls}>Discount</th>
                  <th className={thCls}>Expires</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(data?.coupons ?? []).map((c) => (
                  <tr key={c.code} className={trCls}>
                    <td className={cx(tdCls, "font-semibold text-ink")}>{c.code}</td>
                    <td className={tdCls}>{c.discountPercent}%</td>
                    <td className={cx(tdCls, "text-muted")}>{c.expiresAt ? fmtDateTime(c.expiresAt) : "Never"}</td>
                    <td className={tdCls}>
                      <Badge tone={state(c) === "Active" ? "success" : state(c) === "Expired" ? "danger" : "neutral"}>{state(c)}</Badge>
                    </td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-3">
                        {state(c) !== "Expired" && (
                          <button type="button" className={linkBtn} onClick={() => toggle(c)}>
                            {c.status === "active" ? "Pause" : "Activate"}
                          </button>
                        )}
                        <button type="button" className={dangerLink} onClick={() => setDel(c)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!data?.coupons.length && (
                  <tr>
                    <td colSpan={5} className={cx(tdCls, "py-10 text-center text-muted")}>
                      No coupons yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmAction
        open={!!del}
        danger
        title={`Delete ${del?.code}?`}
        body="Traders can no longer use this code. Past orders keep their discount."
        confirmLabel="Delete coupon"
        onCancel={() => setDel(null)}
        onConfirm={async () => {
          await crm.coupons.remove(del!.code);
          setDel(null);
          reload();
        }}
      />
    </div>
  );
}
