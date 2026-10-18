"use client";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { money } from "@/lib/mock";
import { crm, type AdminOrder } from "@/lib/crmApi";
import { MODEL_LABEL, planInfo } from "@/lib/portal-data";
import { Card, cx, FormMessage, LoadState } from "@/components/portal/ui";
import { Badge, inputCls, PageHeader, Tabs, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";
import { ConfirmAction, dangerLink, errMsg, fmtDateTime, linkBtn, matches, Modal, Person, SearchBox, useAdmin } from "@/components/crm/kit";

// What each status does on the server (PUT /api/orders) — shown before confirming.
const STATUS_ACTIONS: { value: string; label: string; help: string }[] = [
  { value: "Active", label: "Mark paid / Active", help: "Creates the Phase 1 account (or the Instant funded account) waiting for credential delivery, and settles referral commissions." },
  { value: "Step2 Active", label: "Start Phase 2", help: "Creates a Phase 2 account (2-Step only)." },
  { value: "Live Active", label: "Start funded stage", help: "Creates the funded account." },
  { value: "Passed", label: "Mark latest account passed", help: "Marks the latest account Passed and creates the next stage automatically." },
  { value: "Failed", label: "Mark latest account failed", help: "Fails the latest account of this order." },
  { value: "Replaced", label: "Reset latest account", help: "Resets the latest account to Active with P&L zeroed." },
];

type Filter = "pending" | "proof" | "active" | "all";
const isManual = (o: AdminOrder) => String(o.gatewayRef || "").startsWith("manual:");

function ProofModal({ order, onClose }: { order: AdminOrder | null; onClose: () => void }) {
  const [state, setState] = useState<{ url?: string; walletId?: string; txid?: string; err?: string }>({});
  useEffect(() => {
    if (!order) return;
    setState({});
    crm.orders.paymentProof(order.id).then((r) => setState(r)).catch((e) => setState({ err: errMsg(e) }));
  }, [order]);
  return (
    <Modal open={!!order} title={`Payment proof · ${order?.id ?? ""}`} onClose={onClose} wide>
      {state.err ? (
        <FormMessage tone="error">{state.err}</FormMessage>
      ) : !state.url ? (
        <p className="text-[14px] text-muted">Loading…</p>
      ) : (
        <div className="space-y-4 text-[14px]">
          <p>
            <span className="text-muted">Network:</span> <strong>{state.walletId}</strong> · <span className="text-muted">Amount due:</span>{" "}
            <strong>{money(order?.amountPaid ?? 0)}</strong>
          </p>
          <p className="break-all">
            <span className="text-muted">TXID:</span> <code className="rounded bg-surface-2 px-1.5 py-0.5">{state.txid}</code>
          </p>
          <a href={state.url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.url} alt="Payment screenshot uploaded by the trader" className="max-h-[60vh] w-full rounded-tile border border-line object-contain" />
          </a>
          <p className="text-[12.5px] text-muted">Check the TXID on a block explorer before marking the order paid. The image link expires in 10 minutes.</p>
        </div>
      )}
    </Modal>
  );
}

export default function OrdersDesk() {
  const { data, error, loading, reload } = useAdmin(() => crm.orders.list());
  const [filter, setFilter] = useState<Filter>("pending");
  const [q, setQ] = useState("");
  const [proof, setProof] = useState<AdminOrder | null>(null);
  const [pending, setPending] = useState<{ order: AdminOrder; status: string } | null>(null);
  const [del, setDel] = useState<AdminOrder | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filter");
    if (f === "proof" || f === "active" || f === "all") setFilter(f);
  }, []);

  const orders = data?.orders ?? [];
  const list = orders.filter((o) => {
    const s = o.status.toLowerCase();
    const inTab = filter === "all" || (filter === "pending" ? s === "pending" : filter === "proof" ? s === "pending" && isManual(o) : s !== "pending" && !s.includes("fail"));
    return inTab && matches(q, o.id, o.userName, o.userEmail, o.couponUsed, o.paymentMethod);
  });
  const count = (f: Filter) =>
    orders.filter((o) => {
      const s = o.status.toLowerCase();
      return f === "pending" ? s === "pending" : f === "proof" ? s === "pending" && isManual(o) : f === "active" ? s !== "pending" && !s.includes("fail") : true;
    }).length;

  const toggleLegacy = async (o: AdminOrder) => {
    setMsg("");
    try {
      await crm.orders.setLegacyRules(o.id, !o.legacyRules);
      reload();
    } catch (e) {
      setMsg(errMsg(e));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Orders" sub="Confirm payments and move orders through their lifecycle." />
      <Card>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs<Filter>
            tabs={[
              { key: "pending", label: "Awaiting payment", count: count("pending") },
              { key: "proof", label: "Crypto proof submitted", count: count("proof") },
              { key: "active", label: "Paid / active", count: count("active") },
              { key: "all", label: "All", count: count("all") },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <SearchBox value={q} onChange={setQ} placeholder="Search order, trader, code…" />
        </div>
        {msg && <div className="mb-4"><FormMessage tone="error">{msg}</FormMessage></div>}
        <LoadState loading={loading} error={error} onRetry={reload} />
        {!loading && !error && (
          <div className={tableWrap}>
            <table className="w-full min-w-[1080px] border-collapse">
              <thead className="bg-surface-2">
                <tr>
                  <th className={thCls}>Order</th>
                  <th className={thCls}>Trader</th>
                  <th className={thCls}>Challenge</th>
                  <th className={cx(thCls, "text-right")}>Amount</th>
                  <th className={thCls}>Method</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Rules</th>
                  <th className={thCls}>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((o) => {
                  const p = planInfo(o);
                  return (
                    <tr key={o.id} className={trCls}>
                      <td className={tdCls}>
                        <span className="block font-semibold text-ink">{o.id}</span>
                        <span className="block text-[12.5px] text-muted">{fmtDateTime(o.createdAt)}</span>
                      </td>
                      <td className={cx(tdCls, "max-w-[220px]")}>
                        <Person name={o.userName} email={o.userEmail} />
                      </td>
                      <td className={tdCls}>
                        {MODEL_LABEL[p.model]} · {p.size ? money(p.size, 0) : "—"}
                        {o.weekendHoldingAddon && <span className="block text-[12px] text-muted">+ weekend add-on</span>}
                      </td>
                      <td className={cx(tdCls, "text-right font-semibold text-ink")}>
                        {money(o.amountPaid)}
                        {o.couponUsed && <span className="block text-[12px] font-normal text-muted">{o.couponUsed}</span>}
                      </td>
                      <td className={tdCls}>
                        {o.paymentMethod}
                        {isManual(o) && (
                          <button type="button" onClick={() => setProof(o)} className={cx(linkBtn, "flex items-center gap-1")}>
                            View proof <ExternalLink size={12} />
                          </button>
                        )}
                      </td>
                      <td className={tdCls}>
                        <Badge>{o.status}</Badge>
                      </td>
                      <td className={tdCls}>
                        <button type="button" onClick={() => toggleLegacy(o)} className={linkBtn} title="Pin this order to the pre-2026-09 rulebook">
                          {o.legacyRules ? "Legacy" : "Current"}
                        </button>
                      </td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-3">
                          <select
                            aria-label={`Change status of ${o.id}`}
                            className={cx(inputCls, "h-9 w-48 py-0 text-[13px]")}
                            value=""
                            onChange={(e) => e.target.value && setPending({ order: o, status: e.target.value })}
                          >
                            <option value="">Change status…</option>
                            {STATUS_ACTIONS.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <button type="button" onClick={() => setDel(o)} className={dangerLink}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!list.length && (
                  <tr>
                    <td colSpan={8} className={cx(tdCls, "py-10 text-center text-muted")}>
                      Nothing here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ProofModal order={proof} onClose={() => setProof(null)} />

      <ConfirmAction
        open={!!pending}
        title={`Set ${pending?.order.id} to “${pending?.status}”?`}
        body={
          <>
            <p>{STATUS_ACTIONS.find((s) => s.value === pending?.status)?.help}</p>
            <p className="mt-2 text-muted">
              Trader: {pending?.order.userName} ({pending?.order.userEmail}) · {money(pending?.order.amountPaid ?? 0)}
            </p>
          </>
        }
        confirmLabel="Confirm"
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          await crm.orders.setStatus(pending!.order.id, pending!.status);
          setPending(null);
          reload();
        }}
      />

      <ConfirmAction
        open={!!del}
        danger
        title={`Delete order ${del?.id}?`}
        body="This deletes the order and every trading account created from it, and returns their credentials to the inventory. It cannot be undone."
        confirmLabel="Delete order"
        onCancel={() => setDel(null)}
        onConfirm={async () => {
          await crm.orders.remove(del!.id);
          setDel(null);
          reload();
        }}
      />
    </div>
  );
}
