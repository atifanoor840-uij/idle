"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ExternalLink } from "lucide-react";
import { money } from "@/lib/mock";
import { crm, type AdminAccount, type InventoryItem } from "@/lib/crmApi";
import type { Order } from "@/lib/propApi";
import { MODEL_LABEL, planInfo } from "@/lib/portal-data";
import { btnPrimary, btnSecondary, Card, cx, FormMessage, LoadState } from "@/components/portal/ui";
import { Badge, Field, inputCls, PageHeader, Tabs, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";
import { ConfirmAction, dangerLink, errMsg, fmtDateTime, linkBtn, matches, Modal, Person, SearchBox, useAdmin } from "@/components/crm/kit";

type Filter = "deliver" | "Active" | "Passed" | "Funded" | "Failed" | "all";
const PLATFORMS = ["MT5", "MT4", "cTrader"] as const;

type Row = AdminAccount & { size: number; plan: string };

function DeliverModal({ account, inventory, onClose, onDone }: { account: Row | null; inventory: InventoryItem[]; onClose: () => void; onDone: () => void }) {
  const blank = { platform: "MT5", login: "", passwordMaster: "", passwordInvestor: "", server: "", externalStatisticsId: "", graphLink: "", inventoryItemId: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!account) return;
    setErr("");
    setBusy(false);
    setF({ ...blank, platform: PLATFORMS.includes(account.platform as (typeof PLATFORMS)[number]) ? account.platform : "MT5" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const options = inventory.filter((i) => i.status === "available" && (!account?.size || Number(i.size) === account.size));
  const pick = (id: string) => {
    const i = inventory.find((x) => x.id === id);
    if (!i) return setF({ ...f, inventoryItemId: "" });
    setF({ ...f, inventoryItemId: i.id, platform: i.platform, login: i.login, passwordMaster: i.password, server: i.server, externalStatisticsId: i.externalStatisticsId || "", graphLink: i.graphLink || "" });
  };
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value, ...(k !== "inventoryItemId" && f.inventoryItemId ? { inventoryItemId: "" } : {}) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!account) return;
    setBusy(true);
    setErr("");
    try {
      await crm.accounts.save({
        id: account.id,
        platform: f.platform,
        login: f.login.trim(),
        passwordMaster: f.passwordMaster,
        passwordInvestor: f.passwordInvestor || undefined,
        server: f.server.trim(),
        externalStatisticsId: f.externalStatisticsId.trim() || undefined,
        graphLink: f.graphLink.trim() || undefined,
        inventoryItemId: f.inventoryItemId || undefined,
      });
      onDone();
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <Modal open={!!account} title="Deliver credentials" onClose={onClose} wide>
      {account && (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-[14px] text-ink-2">
            {account.userName} ({account.userEmail}) · {account.plan} · {account.phase || "—"}
          </p>
          <Field label="From inventory" hint={options.length ? "Picking a row fills the fields and marks it delivered." : "No available credentials of this size — enter them manually."}>
            <select className={inputCls} value={f.inventoryItemId} onChange={(e) => pick(e.target.value)}>
              <option value="">Enter manually</option>
              {options.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.platform} · {i.login} · {i.server} · {money(Number(i.size), 0)}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Platform">
              <select className={inputCls} value={f.platform} onChange={set("platform")}>
                {PLATFORMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Server">
              <input className={inputCls} required value={f.server} onChange={set("server")} />
            </Field>
            <Field label="Login">
              <input className={inputCls} required value={f.login} onChange={set("login")} autoComplete="off" />
            </Field>
            <Field label="Master password">
              <input className={inputCls} required value={f.passwordMaster} onChange={set("passwordMaster")} autoComplete="off" />
            </Field>
            <Field label="Investor password (optional)">
              <input className={inputCls} value={f.passwordInvestor} onChange={set("passwordInvestor")} autoComplete="off" />
            </Field>
            <Field label="Statistics (Graph) ID" hint="Needed for live stats and automatic rule checks.">
              <input className={inputCls} value={f.externalStatisticsId} onChange={set("externalStatisticsId")} placeholder="e.g. smt_12345" />
            </Field>
            <Field label="Analytics link (optional)" className="sm:col-span-2">
              <input className={inputCls} type="url" value={f.graphLink} onChange={set("graphLink")} placeholder="https://" />
            </Field>
          </div>
          {err && <FormMessage tone="error">{err}</FormMessage>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? "Delivering…" : "Deliver & email trader"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function EditAccountModal({
  account,
  onClose,
  onDone,
}: {
  account: Row | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [f, setF] = useState({
    platform: "MT5",
    server: "",
    login: "",
    passwordMaster: "",
    passwordInvestor: "",
    status: "Active" as AdminAccount["status"],
    phase: "Phase 1 (Evaluation)",
    balance: 100000,
    equity: 100000,
    todayPl: 0,
    totalPl: 0,
    profitTarget: 8000,
    graphLink: "",
    externalStatisticsId: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!account) return;
    setErr("");
    setBusy(false);
    setF({
      platform: account.platform || "MT5",
      server: account.server || "",
      login: account.login || "",
      passwordMaster: account.passwordMaster || "",
      passwordInvestor: account.passwordInvestor || "",
      status: account.status || "Active",
      phase: account.phase || "Phase 1 (Evaluation)",
      balance: Number(account.balance) || account.size || 100000,
      equity: Number(account.equity) || Number(account.balance) || account.size || 100000,
      todayPl: Number(account.todayPl) || 0,
      totalPl: Number(account.totalPl) || 0,
      profitTarget: Number(account.profitTarget) || 0,
      graphLink: String(account.graphLink || ""),
      externalStatisticsId: String(account.externalStatisticsId || ""),
    });
  }, [account]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!account) return;
    setBusy(true);
    setErr("");
    try {
      await crm.accounts.save({
        id: account.id,
        platform: f.platform,
        server: f.server.trim(),
        login: f.login.trim(),
        passwordMaster: f.passwordMaster,
        passwordInvestor: f.passwordInvestor || undefined,
        status: f.status,
        phase: f.phase,
        balance: Number(f.balance),
        equity: Number(f.equity),
        todayPl: Number(f.todayPl),
        totalPl: Number(f.totalPl),
        profitTarget: Number(f.profitTarget),
        graphLink: f.graphLink.trim() || undefined,
        externalStatisticsId: f.externalStatisticsId.trim() || undefined,
      });
      onDone();
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <Modal open={!!account} title={`Edit Account · #${account?.login || account?.id}`} onClose={onClose} wide>
      {account && (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-tile bg-surface-2 p-3 text-[13px] text-muted flex flex-wrap justify-between gap-2 border border-line">
            <span>Trader: <strong className="text-ink">{account.userName}</strong> ({account.userEmail})</span>
            <span>Plan: <strong className="text-ink">{account.plan}</strong></span>
            <span>Order ID: <strong className="text-ink">{account.orderId}</strong></span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Platform">
              <select className={inputCls} value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>
                {PLATFORMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>

            <Field label="Server">
              <input className={inputCls} required value={f.server} onChange={(e) => setF({ ...f, server: e.target.value })} />
            </Field>

            <Field label="Login">
              <input className={inputCls} required value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} autoComplete="off" />
            </Field>

            <Field label="Master Password">
              <input className={inputCls} required value={f.passwordMaster} onChange={(e) => setF({ ...f, passwordMaster: e.target.value })} autoComplete="off" />
            </Field>

            <Field label="Investor Password (Optional)">
              <input className={inputCls} value={f.passwordInvestor} onChange={(e) => setF({ ...f, passwordInvestor: e.target.value })} autoComplete="off" />
            </Field>

            <Field label="Status">
              <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as AdminAccount["status"] })}>
                <option value="Active">Active</option>
                <option value="Passed">Passed</option>
                <option value="Funded">Funded</option>
                <option value="Failed">Failed (Breached)</option>
              </select>
            </Field>

            <Field label="Phase">
              <select className={inputCls} value={f.phase} onChange={(e) => setF({ ...f, phase: e.target.value })}>
                <option value="Phase 1 (Evaluation)">Phase 1 (Evaluation)</option>
                <option value="Phase 2 (Verification)">Phase 2 (Verification)</option>
                <option value="Funded (Live)">Funded (Live)</option>
              </select>
            </Field>

            <Field label="Profit Target ($)">
              <input className={inputCls} type="number" step="any" value={f.profitTarget} onChange={(e) => setF({ ...f, profitTarget: Number(e.target.value) })} />
            </Field>

            <Field label="Current Balance ($)">
              <input className={inputCls} type="number" step="any" required value={f.balance} onChange={(e) => setF({ ...f, balance: Number(e.target.value) })} />
            </Field>

            <Field label="Current Equity ($)">
              <input className={inputCls} type="number" step="any" required value={f.equity} onChange={(e) => setF({ ...f, equity: Number(e.target.value) })} />
            </Field>

            <Field label="Today's P&L ($)">
              <input className={inputCls} type="number" step="any" value={f.todayPl} onChange={(e) => setF({ ...f, todayPl: Number(e.target.value) })} />
            </Field>

            <Field label="Total P&L ($)">
              <input className={inputCls} type="number" step="any" value={f.totalPl} onChange={(e) => setF({ ...f, totalPl: Number(e.target.value) })} />
            </Field>

            <Field label="Analytics / Graph Link (URL)" hint="Link opened when trader clicks 'Full analytics' on their balance curve chart." className="sm:col-span-2">
              <input className={inputCls} type="url" value={f.graphLink} onChange={(e) => setF({ ...f, graphLink: e.target.value })} placeholder="https://www.tradingview.com/..." />
            </Field>

            <Field label="External Statistics ID" hint="ShowMyTrades or broker API ID for automated real-time equity curves and closed trades." className="sm:col-span-2">
              <input className={inputCls} value={f.externalStatisticsId} onChange={(e) => setF({ ...f, externalStatisticsId: e.target.value })} placeholder="e.g. smt_12345" />
            </Field>
          </div>

          {err && <FormMessage tone="error">{err}</FormMessage>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={btnSecondary}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function AccountsDesk() {
  const { data, error, loading, reload } = useAdmin(async () => {
    const [a, o, i] = await Promise.all([crm.accounts.list(), crm.orders.list(), crm.inventory.list().catch(() => ({ plans: [] as InventoryItem[] }))]);
    const byId = new Map<string, Order>(o.orders.map((x) => [x.id, x]));
    const rows: Row[] = a.accounts.map((acc) => {
      const p = planInfo(byId.get(acc.orderId));
      return { ...acc, size: p.size, plan: `${MODEL_LABEL[p.model]} · ${p.size ? money(p.size, 0) : "—"}` };
    });
    return { rows, inventory: i.plans };
  });
  const [filter, setFilter] = useState<Filter>("deliver");
  const [q, setQ] = useState("");
  const [deliver, setDeliver] = useState<Row | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const [statusFor, setStatusFor] = useState<{ acc: Row; status: AdminAccount["status"] } | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  const [note, setNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const inTab = (r: Row, f: Filter) => (f === "all" ? true : f === "deliver" ? r.deliveryStatus === "pending" : r.deliveryStatus !== "pending" && r.status === f);
  const list = rows.filter((r) => inTab(r, filter) && matches(q, r.id, r.login, r.userName, r.userEmail, r.orderId, r.server));

  const refresh = async (r: Row) => {
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
      <PageHeader title="Accounts & Delivery" sub="Deliver login details, then manage each account's stage and live stats." />
      <Card>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs<Filter>
            tabs={(
              [
                ["deliver", "To deliver"],
                ["Active", "Active"],
                ["Passed", "Passed"],
                ["Funded", "Funded"],
                ["Failed", "Failed"],
                ["all", "All"],
              ] as [Filter, string][]
            ).map(([key, label]) => ({ key, label, count: rows.filter((r) => inTab(r, key)).length }))}
            value={filter}
            onChange={setFilter}
          />
          <SearchBox value={q} onChange={setQ} placeholder="Search login, trader, order…" />
        </div>
        {note && <div className="mb-4"><FormMessage tone={note.tone}>{note.text}</FormMessage></div>}
        <LoadState loading={loading} error={error} onRetry={reload} />
        {!loading && !error && (
          <div className={tableWrap}>
            <table className="w-full min-w-[1100px] border-collapse">
              <thead className="bg-surface-2">
                <tr>
                  <th className={thCls}>Trader</th>
                  <th className={thCls}>Challenge</th>
                  <th className={thCls}>Login</th>
                  <th className={thCls}>Phase</th>
                  <th className={thCls}>Status</th>
                  <th className={cx(thCls, "text-right")}>Balance</th>
                  <th className={thCls}>Stats &amp; Graph</th>
                  <th className={thCls}>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const pendingDelivery = r.deliveryStatus === "pending";
                  return (
                    <tr key={r.id} className={trCls}>
                      <td className={cx(tdCls, "max-w-[220px]")}>
                        <Person name={r.userName} email={r.userEmail} />
                      </td>
                      <td className={tdCls}>
                        {r.plan}
                        <span className="block text-[12px] text-muted">{r.orderId}</span>
                      </td>
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
                        <Badge>{pendingDelivery ? "Pending" : r.status === "Failed" ? "Breached" : r.status}</Badge>
                      </td>
                      <td className={cx(tdCls, "text-right")}>
                        <span className="font-semibold">{money(Number(r.balance) || 0)}</span>
                        {Number(r.equity) && Number(r.equity) !== Number(r.balance) ? (
                          <span className="block text-[11px] text-muted">Eq: {money(Number(r.equity))}</span>
                        ) : null}
                      </td>
                      <td className={cx(tdCls, "text-[12.5px] text-muted")}>
                        <div>{r.statisticsUpdatedAt ? fmtDateTime(r.statisticsUpdatedAt) : "—"}</div>
                        {r.graphLink ? (
                          <a
                            href={r.graphLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-brand-strong hover:underline mt-0.5"
                          >
                            <ExternalLink size={12} /> Graph link
                          </a>
                        ) : null}
                      </td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2.5">
                          {pendingDelivery ? (
                            <button type="button" onClick={() => setDeliver(r)} className={cx(btnPrimary, "h-9 px-3.5")}>
                              Deliver
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setEdit(r)}
                                className={cx(btnSecondary, "h-9 px-3 text-[13px] font-semibold")}
                              >
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
                          <button type="button" onClick={() => setDel(r)} className={dangerLink}>
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
        open={!!del}
        danger
        title="Delete this account?"
        body="Its credentials go back to the inventory and the order rolls back to the previous stage. The trader is notified."
        confirmLabel="Delete account"
        onCancel={() => setDel(null)}
        onConfirm={async () => {
          await crm.accounts.remove(del!.id);
          setDel(null);
          reload();
        }}
      />
    </div>
  );
}
