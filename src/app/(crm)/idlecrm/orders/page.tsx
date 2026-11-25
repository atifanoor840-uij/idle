"use client";
// Orders & Accounts: one desk for confirming payments, delivering credentials,
// managing each account's stage, viewing its graph and signing in as the trader.
import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, LineChart, LogIn } from "lucide-react";
import { money } from "@/lib/mock";
import { crm, type AdminAccount, type AdminOrder, type InventoryItem } from "@/lib/crmApi";
import { MODEL_LABEL, planInfo } from "@/lib/portal-data";
import { getStatisticsDataSyncedAt } from "@/lib/statisticsSync";
import { btnPrimary, btnSecondary, Card, cx, FormMessage, LoadState } from "@/components/portal/ui";
import { Badge, inputCls, PageHeader, Tabs, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";
import { ConfirmAction, dangerLink, errMsg, fmtDateTime, linkBtn, matches, Modal, Person, RefreshButton, SearchBox, useAdmin } from "@/components/crm/kit";
import { DeliverModal, EditAccountModal, type AccountRow } from "@/components/crm/AccountModals";
import AccountGraphModal from "@/components/crm/AccountGraphModal";

// What each status does on the server (PUT /api/orders) — shown before confirming.
const STATUS_ACTIONS: { value: string; label: string; help: string }[] = [
  { value: "Active", label: "Mark paid / Active", help: "Creates the Phase 1 account (or the Instant funded account) waiting for credential delivery, and settles referral commissions." },
  { value: "Step2 Active", label: "Start Phase 2", help: "Creates a Phase 2 account (2-Step only)." },
  { value: "Live Active", label: "Start funded stage", help: "Creates the funded account." },
  { value: "Passed", label: "Mark latest account passed", help: "Marks the latest account Passed and creates the next stage automatically." },
  { value: "Failed", label: "Mark latest account failed", help: "Fails the latest account of this order." },
  { value: "Replaced", label: "Reset latest account", help: "Resets the latest account to Active with P&L zeroed." },
];

type Filter = "pending" | "proof" | "deliver" | "active" | "failed" | "all";
type OrderRow = AdminOrder & { accounts: AccountRow[]; plan: string };

const isManual = (o: AdminOrder) => String(o.gatewayRef || "").startsWith("manual:");
const toDeliver = (o: OrderRow) => o.accounts.some((a) => a.deliveryStatus === "pending");
const inTab = (o: OrderRow, f: Filter) => {
  const s = o.status.toLowerCase();
  switch (f) {
    case "pending":
      return s === "pending";
    case "proof":
      return s === "pending" && isManual(o);
    case "deliver":
      return toDeliver(o);
    case "active":
      return s !== "pending" && !s.includes("fail");
    case "failed":
      return s.includes("fail");
    default:
      return true;
  }
};
const accountBadge = (a: AccountRow) => (a.deliveryStatus === "pending" ? "Pending" : a.status === "Failed" ? "Breached" : a.status);

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
  const { data, error, loading, reload } = useAdmin(async () => {
    const [o, a, i] = await Promise.all([crm.orders.list(), crm.accounts.list(), crm.inventory.list().catch(() => ({ plans: [] as InventoryItem[] }))]);
    const byOrder = new Map<string, AccountRow[]>();
    const orders: OrderRow[] = o.orders.map((ord) => {
      const p = planInfo(ord);
      return { ...ord, accounts: [], plan: `${MODEL_LABEL[p.model]} · ${p.size ? money(p.size, 0) : "—"}` };
    });
    const orderById = new Map(orders.map((x) => [x.id, x]));
    for (const acc of a.accounts) {
      const ord = orderById.get(acc.orderId);
      const p = planInfo(ord);
      const row: AccountRow = { ...acc, size: p.size, plan: ord?.plan ?? "—" };
      byOrder.set(acc.orderId, [...(byOrder.get(acc.orderId) ?? []), row]);
    }
    // Accounts come newest first; show each order's stages oldest → newest.
    for (const ord of orders) ord.accounts = (byOrder.get(ord.id) ?? []).reverse();
    return { orders, inventory: i.plans };
  });

  const [filter, setFilter] = useState<Filter>("pending");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [proof, setProof] = useState<AdminOrder | null>(null);
  const [pending, setPending] = useState<{ order: AdminOrder; status: string } | null>(null);
  const [del, setDel] = useState<AdminOrder | null>(null);
  const [deliver, setDeliver] = useState<AccountRow | null>(null);
  const [edit, setEdit] = useState<AccountRow | null>(null);
  const [statusFor, setStatusFor] = useState<{ acc: AccountRow; status: AdminAccount["status"] } | null>(null);
  const [delAcc, setDelAcc] = useState<AccountRow | null>(null);
  const [graph, setGraph] = useState<{ orderId: string; accountId?: string } | null>(null);
  const [signInAs, setSignInAs] = useState<OrderRow | null>(null);
  const [note, setNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filter");
    if (f === "proof" || f === "deliver" || f === "active" || f === "failed" || f === "all") setFilter(f);
  }, []);

  const orders = useMemo(() => data?.orders ?? [], [data]);
  const list = orders.filter(
    (o) => inTab(o, filter) && matches(q, o.id, o.userName, o.userEmail, o.couponUsed, o.paymentMethod, ...o.accounts.flatMap((a) => [a.login, a.server, a.id])),
  );
  const graphAccounts = graph ? orders.find((o) => o.id === graph.orderId)?.accounts ?? [] : null;

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleLegacy = async (o: AdminOrder) => {
    setNote(null);
    try {
      await crm.orders.setLegacyRules(o.id, !o.legacyRules);
      reload();
    } catch (e) {
      setNote({ tone: "error", text: errMsg(e) });
    }
  };

  const refresh = async (r: AccountRow) => {
    setNote(null);
    try {
      const res = await crm.accounts.refreshStats(r.id);
      setNote(res.error ? { tone: "error", text: `Stats for ${r.login}: ${res.error}` } : { tone: "success", text: `Stats refreshed for ${r.login}.` });
      reload();
    } catch (e) {
      setNote({ tone: "error", text: errMsg(e) });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders & Accounts"
        sub="Confirm payments, deliver login details, track each account's stage and graph — all from the order."
        actions={<RefreshButton onRefresh={reload} loading={loading} />}
      />
      <Card>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs<Filter>
            tabs={(
              [
                ["pending", "Awaiting payment"],
                ["proof", "Crypto proof submitted"],
                ["deliver", "To deliver"],
                ["active", "Paid / active"],
                ["failed", "Failed"],
                ["all", "All"],
              ] as [Filter, string][]
            ).map(([key, label]) => ({ key, label, count: orders.filter((o) => inTab(o, key)).length }))}
            value={filter}
            onChange={setFilter}
          />
          <SearchBox value={q} onChange={setQ} placeholder="Search order, trader, login…" />
        </div>
        {note && (
          <div className="mb-4">
            <FormMessage tone={note.tone}>{note.text}</FormMessage>
          </div>
        )}
        {/* Keep the table on screen while a refresh runs. */}
        <LoadState loading={loading && !data} error={error} onRetry={reload} />
        {(!loading || data) && !error && (
          <div className={tableWrap}>
            <table className="w-full min-w-[1180px] border-collapse">
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
                  const isOpen = open.has(o.id);
                  const firstPending = o.accounts.find((a) => a.deliveryStatus === "pending");
                  const latest = o.accounts.at(-1);
                  return (
                    <Fragment key={o.id}>
                      <tr className={trCls}>
                        <td className={tdCls}>
                          <button type="button" onClick={() => toggle(o.id)} className="flex items-start gap-1.5 text-left" aria-expanded={isOpen}>
                            {isOpen ? <ChevronDown size={16} className="mt-0.5 shrink-0" /> : <ChevronRight size={16} className="mt-0.5 shrink-0" />}
                            <span>
                              <span className="block font-semibold text-ink">{o.id}</span>
                              <span className="block text-[12.5px] text-muted">{fmtDateTime(o.createdAt)}</span>
                            </span>
                          </button>
                        </td>
                        <td className={cx(tdCls, "max-w-[220px]")}>
                          <Person name={o.userName} email={o.userEmail} />
                        </td>
                        <td className={tdCls}>
                          {o.plan}
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
                          <button type="button" onClick={() => toggle(o.id)} className="mt-1 block text-[12px] text-muted hover:underline">
                            {o.accounts.length
                              ? `${o.accounts.length} account${o.accounts.length > 1 ? "s" : ""}${firstPending ? " · to deliver" : latest ? ` · ${accountBadge(latest)}` : ""}`
                              : "No account yet"}
                          </button>
                        </td>
                        <td className={tdCls}>
                          <button type="button" onClick={() => toggleLegacy(o)} className={linkBtn} title="Pin this order to the pre-2026-09 rulebook">
                            {o.legacyRules ? "Legacy" : "Current"}
                          </button>
                        </td>
                        <td className={tdCls}>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            {firstPending && (
                              <button type="button" onClick={() => setDeliver(firstPending)} className={cx(btnPrimary, "h-9 px-3.5")}>
                                Deliver
                              </button>
                            )}
                            <select
                              aria-label={`Change status of ${o.id}`}
                              className={cx(inputCls, "h-9 w-44 py-0 text-[13px]")}
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
                            <button
                              type="button"
                              onClick={() => setGraph({ orderId: o.id, accountId: latest?.id })}
                              disabled={!o.accounts.length}
                              className={cx(linkBtn, "inline-flex items-center gap-1")}
                              title={o.accounts.length ? "View the account's balance graph" : "No account yet"}
                            >
                              <LineChart size={13} /> Graph
                            </button>
                            <button type="button" onClick={() => setSignInAs(o)} className={cx(dangerLink, "inline-flex items-center gap-1")}>
                              <LogIn size={13} /> Sign in as
                            </button>
                            <button type="button" onClick={() => setDel(o)} className={dangerLink}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="bg-surface-2/50">
                          <td colSpan={8} className="px-4 pb-4 pt-1">
                            {!o.accounts.length ? (
                              <p className="py-3 text-[13px] text-muted">
                                No trading account yet. Mark the order paid / Active to create the first account.
                              </p>
                            ) : (
                              <table className="w-full border-collapse rounded-tile border border-line bg-surface">
                                <thead>
                                  <tr>
                                    <th className={thCls}>Login</th>
                                    <th className={thCls}>Phase</th>
                                    <th className={thCls}>Status</th>
                                    <th className={cx(thCls, "text-right")}>Balance</th>
                                    <th className={thCls}>Stats</th>
                                    <th className={thCls}>Account action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {o.accounts.map((r) => {
                                    const pendingDelivery = r.deliveryStatus === "pending";
                                    const synced = getStatisticsDataSyncedAt(r.statisticsPayload);
                                    return (
                                      <tr key={r.id} className={trCls}>
                                        <td className={tdCls}>
                                          {pendingDelivery ? (
                                            <span className="text-muted">Not delivered</span>
                                          ) : (
                                            <>
                                              <span className="block font-semibold text-ink">{r.login}</span>
                                              <span className="block text-[12px] text-muted">
                                                {r.platform} · {r.server}
                                              </span>
                                            </>
                                          )}
                                        </td>
                                        <td className={tdCls}>{r.phase || "—"}</td>
                                        <td className={tdCls}>
                                          <Badge>{accountBadge(r)}</Badge>
                                        </td>
                                        <td className={cx(tdCls, "text-right")}>
                                          <span className="font-semibold">{money(Number(r.balance) || 0)}</span>
                                          {Number(r.equity) && Number(r.equity) !== Number(r.balance) ? (
                                            <span className="block text-[11px] text-muted">Eq: {money(Number(r.equity))}</span>
                                          ) : null}
                                        </td>
                                        <td className={cx(tdCls, "text-[12.5px] text-muted")}>
                                          <div>{r.statisticsUpdatedAt ? fmtDateTime(r.statisticsUpdatedAt) : "—"}</div>
                                          {synced && <div className="text-[11px]">Data synced {fmtDateTime(synced)}</div>}
                                          {r.statisticsPayload?._statsSync?.lastError && (
                                            <div className="text-[11px] text-danger">{String(r.statisticsPayload._statsSync.lastError)}</div>
                                          )}
                                        </td>
                                        <td className={tdCls}>
                                          <div className="flex flex-wrap items-center gap-2.5">
                                            {pendingDelivery ? (
                                              <button type="button" onClick={() => setDeliver(r)} className={cx(btnPrimary, "h-9 px-3.5")}>
                                                Deliver
                                              </button>
                                            ) : (
                                              <>
                                                <button type="button" onClick={() => setEdit(r)} className={cx(btnSecondary, "h-9 px-3 text-[13px] font-semibold")}>
                                                  Edit
                                                </button>
                                                <select
                                                  aria-label={`Change status of ${r.login}`}
                                                  className={cx(inputCls, "h-9 w-32 py-0 text-[12.5px]")}
                                                  value=""
                                                  onChange={(e) => e.target.value && setStatusFor({ acc: r, status: e.target.value as AdminAccount["status"] })}
                                                >
                                                  <option value="">Status…</option>
                                                  {(["Active", "Passed", "Failed", "Funded"] as const)
                                                    .filter((s) => s !== r.status)
                                                    .map((s) => (
                                                      <option key={s} value={s}>
                                                        {s === "Failed" ? "Breach (fail)" : s}
                                                      </option>
                                                    ))}
                                                </select>
                                                <button type="button" onClick={() => refresh(r)} className={linkBtn}>
                                                  Refresh
                                                </button>
                                              </>
                                            )}
                                            <button type="button" onClick={() => setGraph({ orderId: o.id, accountId: r.id })} className={cx(linkBtn, "inline-flex items-center gap-1")}>
                                              <LineChart size={13} /> Graph
                                            </button>
                                            <button type="button" onClick={() => setDelAcc(r)} className={dangerLink}>
                                              Delete
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
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

      <AccountGraphModal accounts={graphAccounts} initialId={graph?.accountId} onClose={() => setGraph(null)} onRefreshed={reload} />

      <DeliverModal
        account={deliver}
        inventory={data?.inventory ?? []}
        onClose={() => setDeliver(null)}
        onDone={() => {
          setNote({ tone: "success", text: "Credentials delivered and emailed to the trader." });
          setDeliver(null);
          reload();
        }}
      />

      <EditAccountModal
        account={edit}
        onClose={() => setEdit(null)}
        onDone={() => {
          setNote({ tone: "success", text: "Account details updated successfully." });
          setEdit(null);
          reload();
        }}
      />

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
          setOpen((s) => new Set(s).add(pending!.order.id));
          reload();
        }}
      />

      <ConfirmAction
        open={!!statusFor}
        danger={statusFor?.status === "Failed"}
        title={`Set ${statusFor?.acc.login} to ${statusFor?.status}?`}
        body={
          statusFor?.status === "Passed"
            ? "The next stage account is created automatically and waits for delivery."
            : statusFor?.status === "Failed"
              ? "The account and its order are marked failed and the trader is notified."
              : "The trader is notified of the change."
        }
        confirmLabel="Confirm"
        onCancel={() => setStatusFor(null)}
        onConfirm={async () => {
          const a = statusFor!.acc;
          await crm.accounts.save({ id: a.id, platform: a.platform, login: a.login, passwordMaster: a.passwordMaster, passwordInvestor: a.passwordInvestor, server: a.server, status: statusFor!.status });
          setStatusFor(null);
          reload();
        }}
      />

      <ConfirmAction
        open={!!signInAs}
        danger
        title={`Sign in as ${signInAs?.userName || "this trader"}?`}
        body={
          <>
            <p>
              Your browser session switches to {signInAs?.userName} ({signInAs?.userEmail}) and opens their portal
              {signInAs?.accounts.some((a) => a.deliveryStatus !== "pending") ? " on this order's account" : ""}.
            </p>
            <p className="mt-2 text-muted">You will be signed out of the CRM and need to sign in again to come back. This is recorded in the audit log.</p>
          </>
        }
        confirmLabel="Sign in as trader"
        onCancel={() => setSignInAs(null)}
        onConfirm={async () => {
          const o = signInAs!;
          await crm.users.impersonate(o.userId);
          const acc = [...o.accounts].reverse().find((a) => a.deliveryStatus !== "pending");
          window.location.href = acc ? `/accounts/${encodeURIComponent(acc.id)}` : "/dashboard";
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

      <ConfirmAction
        open={!!delAcc}
        danger
        title="Delete this account?"
        body="Its credentials go back to the inventory and the order rolls back to the previous stage. The trader is notified."
        confirmLabel="Delete account"
        onCancel={() => setDelAcc(null)}
        onConfirm={async () => {
          await crm.accounts.remove(delAcc!.id);
          setDelAcc(null);
          reload();
        }}
      />
    </div>
  );
}
