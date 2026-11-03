"use client";
import { useState, type FormEvent } from "react";
import { money } from "@/lib/mock";
import { crm, type InventoryItem } from "@/lib/crmApi";
import { btnPrimary, Card, cx, FormMessage, LoadState } from "@/components/portal/ui";
import { Badge, Field, inputCls, PageHeader, Tabs, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";
import { ConfirmAction, dangerLink, errMsg, matches, SearchBox, useAdmin } from "@/components/crm/kit";

const PLATFORMS = ["MT5", "MT4", "cTrader"] as const;
type Filter = "available" | "delivered" | "all";

export default function InventoryAdmin() {
  const { data, error, loading, reload } = useAdmin(() => crm.inventory.list());
  const blank = { platform: "MT5", size: "", login: "", password: "", server: "", externalStatisticsId: "", graphLink: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [filter, setFilter] = useState<Filter>("available");
  const [q, setQ] = useState("");
  const [del, setDel] = useState<InventoryItem | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const items = data?.plans ?? [];
  const list = items.filter((i) => (filter === "all" || i.status === filter) && matches(q, i.login, i.server, i.platform, i.size, i.orderId));
  const stock = Object.entries(
    items.filter((i) => i.status === "available").reduce<Record<string, number>>((acc, i) => ((acc[`${i.platform} ${money(Number(i.size), 0)}`] = (acc[`${i.platform} ${money(Number(i.size), 0)}`] || 0) + 1), acc), {}),
  );

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!(Number(f.size) >= 1000)) return setMsg({ tone: "error", text: "Enter the account size, e.g. 100000." });
    setBusy(true);
    setMsg(null);
    try {
      await crm.inventory.add({
        platform: f.platform,
        size: Number(f.size),
        login: f.login.trim(),
        password: f.password,
        server: f.server.trim(),
        externalStatisticsId: f.externalStatisticsId.trim() || undefined,
        graphLink: f.graphLink.trim() || undefined,
      });
      setMsg({ tone: "success", text: `Added ${f.platform} ${f.login}. It can now be picked when delivering an account.` });
      setF({ ...blank, platform: f.platform, size: f.size, server: f.server });
      reload();
    } catch (e) {
      setMsg({ tone: "error", text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Credential inventory" sub="Pre-created trading logins. Paid orders pick from here for instant delivery." />
      {stock.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stock.map(([label, n]) => (
            <span key={label} className="rounded-full bg-surface px-3 py-1.5 text-[13px] text-ink-2">
              {label}: <strong className="text-ink">{n}</strong> available
            </span>
          ))}
        </div>
      )}
      <Card title="Add credentials">
        <form onSubmit={add} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Platform">
            <select className={inputCls} value={f.platform} onChange={set("platform")}>
              {PLATFORMS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Account size (USD)">
            <input className={inputCls} type="number" min={1000} step={1000} required value={f.size} onChange={set("size")} />
          </Field>
          <Field label="Server">
            <input className={inputCls} required value={f.server} onChange={set("server")} />
          </Field>
          <Field label="Login">
            <input className={inputCls} required value={f.login} onChange={set("login")} autoComplete="off" />
          </Field>
          <Field label="Password">
            <input className={inputCls} required value={f.password} onChange={set("password")} autoComplete="off" />
          </Field>
          <Field label="Statistics (Graph) ID">
            <input className={inputCls} value={f.externalStatisticsId} onChange={set("externalStatisticsId")} />
          </Field>
          <Field label="Analytics link">
            <input className={inputCls} type="url" value={f.graphLink} onChange={set("graphLink")} placeholder="https://" />
          </Field>
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? "Adding…" : "Add to inventory"}
          </button>
        </form>
        {msg && <div className="mt-4"><FormMessage tone={msg.tone}>{msg.text}</FormMessage></div>}
      </Card>

      <Card>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs<Filter>
            tabs={(["available", "delivered", "all"] as Filter[]).map((k) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1), count: items.filter((i) => k === "all" || i.status === k).length }))}
            value={filter}
            onChange={setFilter}
          />
          <SearchBox value={q} onChange={setQ} placeholder="Search login, server…" />
        </div>
        <LoadState loading={loading} error={error} onRetry={reload} />
        {!loading && !error && (
          <div className={tableWrap}>
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="bg-surface-2">
                <tr>
                  <th className={thCls}>Login</th>
                  <th className={thCls}>Platform</th>
                  <th className={thCls}>Size</th>
                  <th className={thCls}>Server</th>
                  <th className={thCls}>Stats ID</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id} className={trCls}>
                    <td className={cx(tdCls, "font-semibold text-ink")}>{i.login}</td>
                    <td className={tdCls}>{i.platform}</td>
                    <td className={tdCls}>{money(Number(i.size), 0)}</td>
                    <td className={tdCls}>{i.server}</td>
                    <td className={cx(tdCls, "text-muted")}>{i.externalStatisticsId || "—"}</td>
                    <td className={tdCls}>
                      <Badge tone={i.status === "available" ? "success" : "neutral"}>{i.status === "available" ? "Available" : `Delivered${i.orderId ? ` · ${i.orderId}` : ""}`}</Badge>
                    </td>
                    <td className={tdCls}>
                      {i.status === "available" && (
                        <button type="button" className={dangerLink} onClick={() => setDel(i)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!list.length && (
                  <tr>
                    <td colSpan={7} className={cx(tdCls, "py-10 text-center text-muted")}>
                      Nothing here.
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
        title={`Delete ${del?.platform} ${del?.login}?`}
        body="It is removed from the pool and can no longer be delivered."
        confirmLabel="Delete"
        onCancel={() => setDel(null)}
        onConfirm={async () => {
          await crm.inventory.remove(del!.id);
          setDel(null);
          reload();
        }}
      />
    </div>
  );
}
