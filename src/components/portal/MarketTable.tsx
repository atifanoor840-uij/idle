import { Fragment } from "react";
import type { Quote } from "@/lib/mock";
import { AssetIcon } from "@/components/AssetIcon";
import { cx } from "./ui";

export default function MarketTable({ groups }: { groups: { group: string; rows: Quote[] }[] }) {
  return (
    <div className="max-h-[420px] overflow-auto rounded-tile border border-line">
      <table className="w-full min-w-[560px] border-collapse text-[14px]">
        <thead className="sticky top-0 z-10 bg-surface-2">
          <tr className="text-[12px] font-semibold uppercase tracking-wide text-muted">
            <th className="px-4 py-3 text-left">Symbol</th>
            <th className="px-4 py-3 text-right">Bid</th>
            <th className="px-4 py-3 text-right">Ask</th>
            <th className="px-4 py-3 text-right">Spread</th>
            <th className="px-4 py-3 text-right">Change</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.group}>
              <tr className="border-t border-line bg-surface">
                <td colSpan={5} className="px-4 pb-1.5 pt-4 text-[12px] font-semibold uppercase tracking-wider text-muted">
                  {g.group}
                </td>
              </tr>
              {g.rows.map((q) => {
                const pts = Math.round((q.ask - q.bid) * 10 ** q.dp);
                return (
                  <tr key={q.symbol} className="h-11 border-t border-line">
                    <td className="px-4">
                      <span className="inline-flex items-center gap-2.5">
                        <AssetIcon symbol={q.symbol} size={20} />
                        <span className="font-semibold text-ink">{q.symbol}</span>
                        <span className="hidden whitespace-nowrap text-[12.5px] text-muted md:inline">{q.name}</span>
                      </span>
                    </td>
                    <td className="px-4 text-right text-ink">{q.bid.toFixed(q.dp)}</td>
                    <td className="px-4 text-right text-ink">{q.ask.toFixed(q.dp)}</td>
                    <td className="px-4 text-right text-muted">{pts}</td>
                    <td className={cx("px-4 text-right font-semibold", q.change >= 0 ? "text-success" : "text-danger")}>
                      {q.change >= 0 ? "+" : ""}
                      {q.change.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
