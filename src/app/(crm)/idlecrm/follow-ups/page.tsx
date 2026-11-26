"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, CreditCard, Megaphone, RotateCcw, Send, ShoppingCart, Tag, UserPlus } from "lucide-react";
import { crm, type FollowUpData, type FollowUpDraft, type FollowUpRecipient, type FollowUpSegmentId } from "@/lib/crmApi";
import { btnPrimary, btnSecondary, Card, cx, FormMessage, LoadState } from "@/components/portal/ui";
import { Badge, Field, inputCls, PageHeader } from "@/components/portal/kit";
import { ConfirmAction, errMsg, fmtDateTime, RefreshButton, SearchBox, useAdmin } from "@/components/crm/kit";

const ICONS: Record<FollowUpSegmentId, typeof Send> = {
  unpaid_orders: ShoppingCart,
  unverified: BadgeCheck,
  no_orders: UserPlus,
  failed_challenge: RotateCcw,
  all_traders: Megaphone,
  pricing: Tag,
};
const sizeLabel = (n: number) => (n >= 1000 ? `$${+(n / 1000).toFixed(1)}K` : `$${n}`);
/** "Skip if emailed recently" window. */
const RECENT_MS = 3 * 864e5;
/** Audience list re-fetch interval so new sign-ups / orders show up live. */
const LIVE_REFRESH_MS = 15_000;
/** Joined / ordered within this window → "New" badge. */
const NEW_MS = 30 * 60_000;
const PLACEHOLDERS = ["{{name}}", "{{plan}}", "{{amount}}", "{{orderId}}", "{{coupon}}"];

const draftFor = (data: FollowUpData, id: FollowUpSegmentId): FollowUpDraft => {
  const draft: FollowUpDraft = { ...data.presets[id], coupon: "" };
  if (id === "pricing") {
    const two = data.plans.filter((p) => p.model === "Two Step");
    draft.planIds = (two.length ? two : data.plans.slice(0, 6)).map((p) => p.id);
  }
  return draft;
};

export default function FollowUpsAdmin() {
  const { data, error, loading, reload } = useAdmin(() => crm.followUps.list());
  const [segment, setSegment] = useState<FollowUpSegmentId>("unpaid_orders");
  const [draft, setDraft] = useState<FollowUpDraft | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [skipRecent, setSkipRecent] = useState(true);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const seg = data?.segments.find((s) => s.id === segment);
  const recent = (r: FollowUpRecipient) => !!r.lastFollowUpAt && Date.now() - new Date(r.lastFollowUpAt).getTime() < RECENT_MS;
  const isNew = (r: FollowUpRecipient) => Date.now() - new Date(r.orderDate ?? r.createdAt).getTime() < NEW_MS;

  // Reset draft + selection when the audience changes; on live refresh, auto-select newcomers.
  const [initFor, setInitFor] = useState<FollowUpSegmentId | null>(null);
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!data || !seg) return;
    if (initFor !== segment) {
      setInitFor(segment);
      setDraft(draftFor(data, segment));
      setSelected(new Set(seg.recipients.filter((r) => !skipRecent || !recent(r)).map((r) => r.userId)));
      seen.current = new Set(seg.recipients.map((r) => r.userId));
      setNote(null);
      return;
    }
    const ids = new Set(seg.recipients.map((r) => r.userId));
    const fresh = seg.recipients.filter((r) => !seen.current.has(r.userId) && (!skipRecent || !recent(r)));
    seen.current = ids;
    setSelected((s) => {
      const n = new Set([...s].filter((id) => ids.has(id)));
      fresh.forEach((r) => n.add(r.userId));
      return n;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, segment]);

  // Live: poll while visible; paused while confirming / sending so the list can't shift mid-send.
  const paused = confirm || sending;
  useEffect(() => {
    if (paused) return;
    const refresh = () => { if (document.visibilityState === "visible") void reload(); };
    const id = setInterval(refresh, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [paused, reload]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const at = (r: FollowUpRecipient) => new Date(r.orderDate ?? r.createdAt).getTime() || 0;
    return (seg?.recipients ?? [])
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.orderId?.toLowerCase().includes(q))
      .sort((a, b) => at(b) - at(a));
  }, [seg, search]);

  const coupon = data?.coupons.find((c) => c.code === draft?.coupon);
  const hasOrder = segment === "unpaid_orders" || segment === "failed_challenge";

  // Debounced server-rendered preview of the exact branded email.
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => {
      crm.followUps
        .preview({ ...draft, withOrder: hasOrder, ...(coupon ? { couponPercent: coupon.discountPercent } : {}) })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 400);
    return () => clearTimeout(t);
  }, [draft, hasOrder, coupon]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allShown = rows.length > 0 && rows.every((r) => selected.has(r.userId));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); rows.forEach((r) => (allShown ? n.delete(r.userId) : n.add(r.userId))); return n; });
  const applySkipRecent = (on: boolean) => {
    setSkipRecent(on);
    if (on && seg) setSelected((s) => new Set([...s].filter((id) => { const r = seg.recipients.find((x) => x.userId === id); return !r || !recent(r); })));
  };

  const set = (k: keyof FollowUpDraft) => (e: { target: { value: string } }) => draft && setDraft({ ...draft, [k]: e.target.value });
  const planIds = new Set(draft?.planIds ?? []);
  const setPlans = (ids: Set<string>) => draft && setDraft({ ...draft, planIds: (data?.plans ?? []).filter((p) => ids.has(p.id)).map((p) => p.id) });
  const togglePlan = (id: string) => { const n = new Set(planIds); if (n.has(id)) n.delete(id); else n.add(id); setPlans(n); };
  const models = [...new Set((data?.plans ?? []).map((p) => p.model))];
  const needsPlans = segment === "pricing" && !planIds.size;
  const count = selected.size;

  const send = async () => {
    if (!draft) return;
    setSending(true);
    try {
      const res = await crm.followUps.send({ ...draft, segment, userIds: [...selected] });
      setConfirm(false);
      setNote({
        tone: res.failedCount ? "error" : "success",
        text: `Sent ${res.sentCount} email${res.sentCount === 1 ? "" : "s"}${res.failedCount ? `, ${res.failedCount} failed: ${res.failed.join(", ")}` : "."}`,
      });
      void reload();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Follow-ups"
        sub="Win back unpaid orders, nudge new sign-ups and send promotions — in your branded email style."
        actions={<RefreshButton onRefresh={reload} loading={loading} />}
      />
      {data && !data.emailConfigured && (
        <FormMessage tone="warning">Email delivery is not configured on the server (RESEND_API_KEY). Emails can't be sent until it is set.</FormMessage>
      )}
      {!data && <Card><LoadState loading={loading} error={error} onRetry={reload} /></Card>}

      {data && draft && seg && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {data.segments.map((s) => {
              const Icon = ICONS[s.id];
              const active = s.id === segment;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSegment(s.id)}
                  className={cx(
                    "rounded-card border p-4 text-left transition",
                    active ? "border-brand-strong bg-brand-soft" : "border-line bg-surface hover:border-ink-2/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Icon size={16} className={active ? "text-brand-strong" : "text-muted"} />
                    <span className="text-xl font-bold tabular-nums text-ink">{s.recipients.length}</span>
                  </div>
                  <p className="mt-2 text-[14px] font-semibold text-ink">{s.label}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-muted">{s.description}</p>
                </button>
              );
            })}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {/* Recipients */}
            <Card title={`Recipients · ${seg.label}`} actions={<span className="text-[12.5px] text-muted">{count} of {seg.recipients.length} selected</span>} className="xl:self-start">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <SearchBox value={search} onChange={setSearch} placeholder="Search name, email or order…" />
                <label className="flex items-center gap-2 text-[12.5px] text-muted">
                  <input type="checkbox" checked={skipRecent} onChange={(e) => applySkipRecent(e.target.checked)} />
                  Skip if emailed in last 3 days
                </label>
              </div>
              {error && <div className="mb-3"><FormMessage tone="error">{error}</FormMessage></div>}
              {!rows.length ? (
                <p className="py-10 text-center text-[14px] text-muted">Nobody in this audience right now.</p>
              ) : (
                <div className="max-h-[34rem] overflow-y-auto rounded-tile border border-line">
                  <label className="flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-2.5 text-[12.5px] font-medium text-muted">
                    <input type="checkbox" checked={allShown} onChange={toggleAll} />
                    Select all {rows.length}
                  </label>
                  {rows.map((r) => (
                    <label key={r.userId} className={cx("flex cursor-pointer items-start gap-3 border-b border-line px-4 py-3 last:border-b-0", selected.has(r.userId) && "bg-brand-soft/40")}>
                      <input type="checkbox" checked={selected.has(r.userId)} onChange={() => toggle(r.userId)} className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[14px] font-medium text-ink">{r.name || "—"}</p>
                          {isNew(r) && <Badge tone="success">New</Badge>}
                          {recent(r) && <Badge tone="warning">Emailed {fmtDateTime(r.lastFollowUpAt!)}</Badge>}
                        </div>
                        <p className="truncate text-[12.5px] text-muted">{r.email} · joined {fmtDateTime(r.createdAt)}</p>
                        {r.orderId && (
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted">
                            <CreditCard size={12} />
                            <span className="text-ink">{r.plan}</span>· ${r.amount?.toFixed(2)} · {r.orderId}
                            {r.orderDate && ` · ${fmtDateTime(r.orderDate)}`}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </Card>

            {/* Composer + preview */}
            <Card
              title="Email"
              actions={
                <button type="button" className={btnSecondary} onClick={() => setDraft(draftFor(data, segment))}>
                  <RotateCcw size={14} /> Reset
                </button>
              }
            >
              <div className="space-y-4">
                {segment === "pricing" && (
                  <Field label={`Accounts in the price list · ${planIds.size} selected`} hint="Shown with their live price (coupon discount applied if you pick one).">
                    {!data.plans.length ? (
                      <FormMessage tone="warning">No active pricing plans. Add plans on the Pricing page first.</FormMessage>
                    ) : (
                      <div className="space-y-3 rounded-tile border border-line p-3">
                        {models.map((m) => {
                          const list = data.plans.filter((p) => p.model === m);
                          const all = list.every((p) => planIds.has(p.id));
                          return (
                            <div key={m}>
                              <div className="mb-1.5 flex items-center justify-between">
                                <p className="text-[12.5px] font-semibold text-ink">{m}</p>
                                <button
                                  type="button"
                                  onClick={() => { const n = new Set(planIds); list.forEach((p) => (all ? n.delete(p.id) : n.add(p.id))); setPlans(n); }}
                                  className="text-[12px] text-brand-strong hover:underline"
                                >
                                  {all ? "Clear" : "Select all"}
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {list.map((p) => {
                                  const on = planIds.has(p.id);
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => togglePlan(p.id)}
                                      className={cx("rounded-md border px-2.5 py-1 text-[12px] tabular-nums transition", on ? "border-brand-strong bg-brand-soft text-ink" : "border-line text-muted")}
                                    >
                                      {sizeLabel(p.size)} · ${p.price}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Field>
                )}
                <Field label="Subject"><input value={draft.subject} onChange={set("subject")} className={inputCls} /></Field>
                <Field label="Heading"><input value={draft.title} onChange={set("title")} className={inputCls} /></Field>
                <Field label="Message">
                  <textarea rows={5} value={draft.message} onChange={set("message")} className={cx(inputCls, "h-auto py-2")} />
                </Field>
                <p className="-mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                  Insert:
                  {PLACEHOLDERS.map((p) => (
                    <button key={p} type="button" onClick={() => setDraft({ ...draft, message: `${draft.message}${p}` })} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono hover:text-ink">
                      {p}
                    </button>
                  ))}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Button text"><input value={draft.ctaLabel} onChange={set("ctaLabel")} className={inputCls} /></Field>
                  <Field label="Button link" hint="A path like /challenges or a full URL"><input value={draft.ctaUrl} onChange={set("ctaUrl")} className={inputCls} /></Field>
                </div>
                <Field label="Coupon (optional)">
                  <select value={draft.coupon} onChange={set("coupon")} className={inputCls}>
                    <option value="">No coupon</option>
                    {data.coupons.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.discountPercent}% off</option>)}
                  </select>
                </Field>

                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-muted">
                    Preview{preview?.subject && <span className="ml-2 text-ink">“{preview.subject}”</span>}
                  </p>
                  <iframe title="Email preview" sandbox="" srcDoc={preview?.html ?? ""} className="h-[30rem] w-full rounded-tile border border-line bg-white" />
                </div>

                <button
                  type="button"
                  className={cx(btnPrimary, "w-full")}
                  disabled={!count || needsPlans || !draft.subject || !draft.title || !draft.message || !data.emailConfigured || sending}
                  onClick={() => setConfirm(true)}
                >
                  <Send size={16} /> {sending ? "Sending…" : `Send to ${count} ${count === 1 ? "person" : "people"}`}
                </button>
                {note && <FormMessage tone={note.tone}>{note.text}</FormMessage>}
              </div>
            </Card>
          </div>

          <ConfirmAction
            open={confirm}
            title="Send follow-up emails?"
            body={
              <>
                “<b className="text-ink">{draft.subject}</b>” will be emailed to <b className="text-ink">{count}</b> {count === 1 ? "person" : "people"} in{" "}
                <b className="text-ink">{seg.label}</b>
                {segment === "pricing" && <> with prices for <b className="text-ink">{planIds.size}</b> account{planIds.size === 1 ? "" : "s"}</>}
                {draft.coupon && <> with coupon <b className="text-ink">{draft.coupon}</b></>}. This can't be undone.
              </>
            }
            confirmLabel={`Send ${count}`}
            onCancel={() => setConfirm(false)}
            onConfirm={async () => {
              try {
                await send();
              } catch (e) {
                throw new Error(errMsg(e));
              }
            }}
          />
        </>
      )}
    </div>
  );
}
