import { Check, X } from "lucide-react";
import PageShell, { PageHero } from "@/components/PageShell";
import { site } from "@/site.config";
import { ALLOWED, CORE_RULES, LEVERAGE_LIMIT, PROHIBITED, PUBLIC_MODELS, RULE_ORDER } from "@/lib/publicRules";

export const metadata = {
  title: `Trading Rules & Evaluation Guidelines — Prop Firm Challenge | ${site.name}`,
  description: `Read the official ${site.name} trading evaluation rules: daily loss limits, maximum drawdown, profit targets, and permitted strategies for our skill-based programs.`,
};

function MarkList({ items, ok }) {
  const Icon = ok ? Check : X;
  return (
    <ul className="mark-list">
      {items.map((a) => (
        <li key={a}>
          <span className={`mark ${ok ? "ok" : "no"}`}>
            <Icon size={14} strokeWidth={3} />
          </span>
          {a}
        </li>
      ))}
    </ul>
  );
}

export default function RulesPage() {
  const present = new Set(PUBLIC_MODELS.flatMap((m) => m.rules.map((r) => r.k)));
  const keys = [...new Set([...RULE_ORDER, ...present])].filter((k) => present.has(k));
  return (
    <PageShell>
      <PageHero
        eyebrow="Evaluation Rules & Guidelines"
        title={"Clear Rules Built for\n**Disciplined Traders**."}
        sub="Transparent parameters for our trading evaluations. Master these limits on simulated accounts to qualify for access to a funded account upon successful evaluation."
        seed={22}
      />

      <section className="section">
        <div className="container">
          <h2 className="h2 sub-h" data-reveal>
            Evaluation Rules at a Glance
          </h2>
          <div className="table-wrap" data-reveal>
            <table className="cmp">
              <thead>
                <tr>
                  <th>Rule</th>
                  {PUBLIC_MODELS.map((m) => (
                    <th key={m.id}>{m.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k}>
                    <td>{k}</td>
                    {PUBLIC_MODELS.map((m) => (
                      <td key={m.id}>{m.rules.find((r) => r.k === k)?.v ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">&ldquo;Funded&rdquo; values apply once a 1-Step or 2-Step trading challenge passes the evaluation.</p>
        </div>
      </section>

      <section className="section section-top0">
        <div className="container">
          <h2 className="h2 sub-h" data-reveal>
            Evaluation Guidelines & Objectives Explained
          </h2>
          <div className="cards-3">
            {CORE_RULES.map((r) => (
              <div className="card rule-card" key={r.title} data-reveal>
                <span className="rule-val">{r.value}</span>
                <h3 className="rule-title">{r.title}</h3>
                <p className="rule-text">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-top0">
        <div className="container cards-2">
          <div className="card" data-reveal>
            <h2 className="h2">Permitted Trading Strategies</h2>
            <MarkList items={ALLOWED} ok />
          </div>
          <div className="card card-dark" data-reveal>
            <h2 className="h2">Prohibited Trading Behaviors</h2>
            <MarkList items={PROHIBITED} />
          </div>
        </div>
      </section>

      <section className="section section-top0" id="instruments">
        <div className="container">
          <div className="card card-center" data-reveal>
            <h2 className="h2">Simulated Leverage up to 1:{LEVERAGE_LIMIT}</h2>
            <p className="plan-blurb">
              The same maximum simulated leverage applies to every instrument across all skill-based programs. Forex, metals, indices, commodities and crypto
              are available on your simulated trading terminal.
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
