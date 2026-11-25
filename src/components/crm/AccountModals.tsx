"use client";
// Credential delivery and account editing modals, used by the Orders & Accounts desk.
import { useEffect, useState, type FormEvent } from "react";
import { money } from "@/lib/mock";
import { crm, type AdminAccount, type InventoryItem } from "@/lib/crmApi";
import { btnPrimary, btnSecondary, FormMessage } from "@/components/portal/ui";
import { Field, inputCls } from "@/components/portal/kit";
import { errMsg, Modal } from "@/components/crm/kit";

const PLATFORMS = ["MT5", "MT4", "cTrader"] as const;

export type AccountRow = AdminAccount & { size: number; plan: string };
type Row = AccountRow;

export function DeliverModal({ account, inventory, onClose, onDone }: { account: Row | null; inventory: InventoryItem[]; onClose: () => void; onDone: () => void }) {
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

export function EditAccountModal({
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
