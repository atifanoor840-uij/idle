"use client";
import { useState, type FormEvent } from "react";
import { money } from "@/lib/mock";
import { crm } from "@/lib/crmApi";
import type { PlanModel, PricingPlan } from "@/lib/propApi";
import { btnPrimary, Card, cx, FormMessage, LoadState } from "@/components/portal/ui";
import { Badge, Field, inputCls, PageHeader, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";
import { ConfirmAction, dangerLink, errMsg, linkBtn, useAdmin } from "@/components/crm/kit";

const MODELS: PlanModel[] = ["Two Step", "One Step", "Instant"];
const k = (n: number) => (n >= 1_000_000 ? `$${n / 1_000_000}M` : `$${n / 1000}K`);
const isActive = (p: PricingPlan) => String(p.status || "active").toLowerCase() === "active";

export default function PricingAdmin() {
  const { data, error, loading, reload } = useAdmin(() => crm.pricing.list());
  const [f, setF] = useState({ model: "Two Step" as PlanModel, size: "", price: "", status: "active" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [del, setDel] = useState<PricingPlan | null>(null);

  const plans = [...(data?.plans ?? [])].sort((a, b) => MODELS.indexOf(a.model) - MODELS.indexOf(b.model) || a.size - b.size);
  const existing = plans.find((p) => p.model === f.model && Number(p.size) === Number(f.size));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const size = Number(f.size);
    const price = Number(f.price);
    if (!(size >= 1000) || !(price > 0)) return setMsg({ tone: "error", text: "Enter an account size (e.g. 100000) and a price above 0." });
    setBusy(true);
    setMsg(null);
    try {
      await crm.pricing.save({ model: f.model, size, price, status: f.status });
      setMsg({ tone: "success", text: `${existing ? "Updated" : "Added"} ${f.model} ${k(size)} at ${money(price)}. The website and checkout update within a minute.` });
      setF({ ...f, size: "", price: "" });
      reload();
    } catch (e) {
      setMsg({ tone: "error", text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (p: PricingPlan) => {
    setMsg(null);
    try {
      await crm.pricing.save({ model: p.model, size: Number(p.size), price: Number(p.price), status: isActive(p) ? "inactive" : "active" });
      reload();
    } catch (e) {
      setMsg({ tone: "error", text: errMsg(e) });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Pricing" sub="The live catalog. The website, the buy page and checkout all read these prices." />
      <Card title="Add or update a plan">
        <form onSubmit={save} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Model">
            <select className={inputCls} value={f.model} onChange={(e) => setF({ ...f, model: e.target.value as PlanModel })}>
              {MODELS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Account size (USD)">
            <input className={inputCls} type="number" min={1000} step={1000} value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })} placeholder="100000" />
          </Field>
          <Field label="Price (USD)" hint={existing ? `Current: ${money(existing.price)}` : undefined}>
            <input className={inputCls} type="number" min={1} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          </Field>
          <Field label="Status">
            <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="active">Active (on sale)</option>
              <option value="inactive">Inactive (hidden)</option>
            </select>
          </Field>
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? "Saving…" : existing ? "Update plan" : "Add plan"}
          </button>
        </form>
        {msg && <div className="mt-4"><FormMessage tone={msg.tone}>{msg.text}</FormMessage></div>}
      </Card>

      <Card title="Catalog">
        <LoadState loading={loading} error={error} onRetry={reload} />
        {!loading && !error && (
          <div className={tableWrap}>
            <table className="w-full min-w-[640px] border-collapse">
              <thead className="bg-surface-2">
                <tr>
                  <th className={thCls}>Model</th>
                  <th className={thCls}>Size</th>
                  <th className={cx(thCls, "text-right")}>Price</th>
                  <th className={cx(thCls, "text-right")}>Price / $10K</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Action</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p, i) => {
                  const per = (Number(p.price) / Number(p.size)) * 10000;
                  const prev = plans[i - 1];
                  // Flag a bigger account priced below a smaller one of the same model.
                  const odd = prev && prev.model === p.model && Number(p.price) < Number(prev.price);
                  return (
                    <tr key={p.id} className={trCls}>
                      <td className={cx(tdCls, "font-semibold text-ink")}>{p.model}</td>
                      <td className={tdCls}>{k(Number(p.size))}</td>
                      <td className={cx(tdCls, "text-right font-semibold", odd ? "text-danger" : "text-ink")}>
                        {money(Number(p.price))}
                        {odd && <span className="block text-[11.5px] font-normal">Cheaper than the smaller size</span>}
                      </td>
                      <td className={cx(tdCls, "text-right text-muted")}>{money(per)}</td>
                      <td className={tdCls}>
                        <Badge tone={isActive(p) ? "success" : "neutral"}>{isActive(p) ? "Active" : "Inactive"}</Badge>
                      </td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-3">
                          <button type="button" className={linkBtn} onClick={() => setF({ model: p.model, size: String(p.size), price: String(p.price), status: isActive(p) ? "active" : "inactive" })}>
                            Edit
                          </button>
                          <button type="button" className={linkBtn} onClick={() => toggle(p)}>
                            {isActive(p) ? "Hide" : "Activate"}
                          </button>
                          <button type="button" className={dangerLink} onClick={() => setDel(p)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmAction
        open={!!del}
        danger
        title={`Delete ${del?.model} ${del ? k(Number(del.size)) : ""}?`}
        body="It disappears from the website and checkout. Existing orders are not affected. To stop selling temporarily, use Hide instead."
        confirmLabel="Delete plan"
        onCancel={() => setDel(null)}
        onConfirm={async () => {
          await crm.pricing.remove(del!.id);
          setDel(null);
          reload();
        }}
      />
    </div>
  );
}
