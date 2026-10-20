"use client";
import { useState } from "react";
import { Award, Check, Download, Share2 } from "lucide-react";
import { money } from "@/lib/mock";
import { api, type Certificate as ApiCertificate } from "@/lib/propApi";
import { fmtDate as dateFmt, useApi } from "@/lib/portal-data";
import { site } from "@/site.config";
import { btnPrimary, btnSecondary, Card, cx, EmptyState, LoadState } from "@/components/portal/ui";
import { Badge, downloadFile, esc, PageHeader, Tabs } from "@/components/portal/kit";

type Certificate = { id: string; type: "Payout" | "Phase Passed"; title: string; name: string; amount: number; date: string; plan: string };
const toCert = (c: ApiCertificate): Certificate => {
  const payout = /payout/i.test(c.planName);
  return { id: c.id, type: payout ? "Payout" : "Phase Passed", title: payout ? "Payout certificate" : "Challenge passed", name: c.traderName, amount: Number(c.accountSize) || 0, date: c.datePassed, plan: c.planName };
};

/* Original certificate artwork as SVG so it can be previewed and downloaded */
function certSvg(c: Certificate) {
  const label = c.type === "Payout" ? "PAYOUT" : "CHALLENGE PASSED";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560" font-family="Plus Jakarta Sans, system-ui, sans-serif">
<rect width="800" height="560" rx="24" fill="#0b0d10"/>
<rect x="18" y="18" width="764" height="524" rx="16" fill="none" stroke="#34E834" stroke-opacity=".35" stroke-width="2"/>
<g opacity=".08" fill="#34E834">${Array.from({ length: 14 }, (_, i) => `<rect x="${500 + i * 20}" y="${420 - i * 18 - (i % 3) * 14}" width="10" height="${40 + i * 18}" rx="2"/>`).join("")}</g>
<rect x="60" y="60" width="44" height="44" rx="10" fill="#000" stroke="#2efb0a" stroke-opacity=".35"/>
<rect x="80.5" y="66" width="3" height="32" rx="1.5" fill="#2efb0a"/><rect x="75" y="72" width="14" height="20" rx="2" fill="#2efb0a"/>
<text x="118" y="90" fill="#fff" font-size="22" font-weight="800" letter-spacing="2">${esc(site.wordmark)}</text>
<text x="60" y="190" fill="#34E834" font-size="16" font-weight="700" letter-spacing="4">${label} CERTIFICATE</text>
<text x="60" y="250" fill="#fff" font-size="44" font-weight="800">${esc(c.name)}</text>
<text x="60" y="300" fill="#9aa0a8" font-size="18">${c.type === "Payout" ? "has received a payout of" : "has passed the evaluation on an account of"}</text>
<text x="60" y="370" fill="#34E834" font-size="56" font-weight="800">${money(c.amount)}</text>
<text x="60" y="480" fill="#9aa0a8" font-size="15">${esc(c.plan)}</text>
<text x="60" y="505" fill="#9aa0a8" font-size="15">${esc(dateFmt(c.date))} · ID ${esc(c.id)}</text>
</svg>`;
}

export default function CertificatesView() {
  const { data, error, loading, reload } = useApi(async () => (await api.certificates()).certificates.map(toCert));
  const certificates = data ?? [];
  const [tab, setTab] = useState<"All" | Certificate["type"]>("All");
  const [shared, setShared] = useState<string | null>(null);
  const list = certificates.filter((c) => tab === "All" || c.type === tab);

  const share = async (c: Certificate) => {
    const text = `${c.title}: ${money(c.amount)} with ${site.name}`;
    try {
      if (navigator.share) await navigator.share({ title: c.title, text });
      else await navigator.clipboard.writeText(text);
      setShared(c.id);
      setTimeout(() => setShared(null), 1500);
    } catch {}
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Certificates" sub="Proof of your milestones. Download them or share them anywhere." />
      <Card>
        <Tabs
          tabs={(["All", "Payout", "Phase Passed"] as const).map((k) => ({ key: k, label: k }))}
          value={tab}
          onChange={setTab}
          className="mb-5"
        />
        <LoadState loading={loading} error={error} onRetry={reload} />
        {loading || error ? null : list.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => (
              <article key={c.id} className="overflow-hidden rounded-tile border border-line bg-surface">
                <div className="bg-surface-2 p-3">
                  <img src={`data:image/svg+xml;utf8,${encodeURIComponent(certSvg(c))}`} alt={`${c.title} preview`} className="w-full rounded-lg" />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[17px] font-semibold text-ink">{c.title}</p>
                      <p className="text-[13px] text-muted">
                        {c.plan} · {dateFmt(c.date)}
                      </p>
                    </div>
                    <Badge tone="brand">{c.type}</Badge>
                  </div>
                  <p className="mt-3 text-[22px] font-bold text-ink">{money(c.amount)}</p>
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={() => downloadFile(`certificate-${c.id}.svg`, certSvg(c), "image/svg+xml")} className={cx(btnPrimary, "flex-1")}>
                      <Download size={16} /> Download
                    </button>
                    <button type="button" onClick={() => share(c)} className={btnSecondary}>
                      {shared === c.id ? <Check size={16} /> : <Share2 size={16} />} {shared === c.id ? "Copied" : "Share"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon={Award} title="No certificates yet" text="Pass a phase or receive a payout to earn your first certificate." />
        )}
      </Card>
    </div>
  );
}
