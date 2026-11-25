"use client";
// Admin view of a trader account's balance curve — the same chart the trader sees.
import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { money } from "@/lib/mock";
import { crm } from "@/lib/crmApi";
import { buildPerformanceSeries } from "@/lib/tradingStatistics";
import { getStatisticsDataSyncedAt } from "@/lib/statisticsSync";
import PnlChart from "@/components/portal/PnlChart";
import { btnSecondary, cx, FormMessage } from "@/components/portal/ui";
import { Badge, inputCls } from "@/components/portal/kit";
import { errMsg, fmtDateTime, Modal } from "@/components/crm/kit";
import type { AccountRow } from "./AccountModals";

export default function AccountGraphModal({
  accounts,
  initialId,
  onClose,
  onRefreshed,
}: {
  /** Accounts of one order; null closes the modal. */
  accounts: AccountRow[] | null;
  initialId?: string;
  onClose: () => void;
  onRefreshed: () => void;
}) {
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!accounts) return;
    setNote(null);
    setBusy(false);
    setId(initialId || accounts[0]?.id || "");
    // Reset only when a different order/account is opened, not on every data reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!accounts, accounts?.[0]?.orderId, initialId]);

  const a = accounts?.find((x) => x.id === id) ?? accounts?.[0];
  const start = a ? a.size || Number(a.balance) || 0 : 0;
  const curve = a
    ? buildPerformanceSeries({
        payload: a.statisticsPayload,
        initialBalance: start,
        currentBalance: Number(a.balance),
        currentEquity: Number(a.equity),
        currentTotalProfit: Number(a.totalPl) || undefined,
      }).map((p) => ({ date: p.date, balance: p.balance }))
    : [];
  const synced = a ? getStatisticsDataSyncedAt(a.statisticsPayload) || a.statisticsUpdatedAt : undefined;

  const refresh = async () => {
    if (!a) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await crm.accounts.refreshStats(a.id);
      setNote(res.error ? { tone: "error", text: res.error } : { tone: "success", text: "Stats refreshed." });
      onRefreshed();
    } catch (e) {
      setNote({ tone: "error", text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!accounts} title={a ? `Graph · ${a.login || a.id}` : "Graph"} onClose={onClose} wide>
      {!a ? (
        <p className="text-[14px] text-muted">This order has no trading account yet.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] text-ink-2">
              {a.userName} ({a.userEmail}) · {a.plan} · {a.phase || "—"} · <Badge>{a.deliveryStatus === "pending" ? "Pending" : a.status === "Failed" ? "Breached" : a.status}</Badge>
            </p>
            {accounts!.length > 1 && (
              <select aria-label="Account" className={cx(inputCls, "h-9 w-56 py-0 text-[13px]")} value={a.id} onChange={(e) => setId(e.target.value)}>
                {accounts!.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.phase || x.status} · {x.login || "not delivered"}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Start", money(start)],
              ["Balance", money(Number(a.balance) || 0)],
              ["Equity", money(Number(a.equity) || 0)],
              ["Total P&L", money(Number(a.totalPl) || 0)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-tile border border-line bg-surface-2 p-3">
                <div className="text-[12px] text-muted">{k}</div>
                <div className="text-[15px] font-semibold text-ink">{v}</div>
              </div>
            ))}
          </div>

          {curve.length > 1 ? (
            <PnlChart data={curve} start={start} />
          ) : (
            <p className="rounded-tile border border-line py-10 text-center text-[14px] text-muted">
              No trading history yet{a.externalStatisticsId ? "" : " — add a Statistics (Graph) ID to the account to pull it in"}.
            </p>
          )}

          {note && <FormMessage tone={note.tone}>{note.text}</FormMessage>}

          <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-muted">
            <span>Last synced: {synced ? fmtDateTime(synced) : "—"}</span>
            <div className="flex items-center gap-3">
              {a.graphLink && (
                <a href={a.graphLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-strong hover:underline">
                  <ExternalLink size={12} /> Full analytics
                </a>
              )}
              {a.deliveryStatus !== "pending" && (
                <button type="button" onClick={refresh} disabled={busy} className={cx(btnSecondary, "h-9 gap-1.5 px-3 text-[13px]")}>
                  <RefreshCw size={13} /> {busy ? "Refreshing…" : "Refresh stats"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
