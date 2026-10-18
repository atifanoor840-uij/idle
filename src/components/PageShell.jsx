import { Nav, TopBar } from "./Header";
import Footer from "./Footer";
import ChatWidget from "./ChatWidget";
import Reveal from "./Reveal";
import { ChartBg, Rich } from "./ui";

/* Shared chrome for every inner marketing page */
export default function PageShell({ children }) {
  return (
    <>
      <TopBar />
      <Nav />
      <main>{children}</main>
      <Footer />
      <ChatWidget />
      <Reveal />
    </>
  );
}

/* Dark intro band at the top of inner pages */
export function PageHero({ eyebrow, title, sub, seed = 9, children }) {
  return (
    <section className="page-hero dark-band">
      <ChartBg seed={seed} />
      <div className="container page-hero-in">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="page-h1">
          <Rich text={title} />
        </h1>
        {sub && <p className="page-sub">{sub}</p>}
        {children}
      </div>
    </section>
  );
}

/* Long-form legal text: sections = [{ h, p: [] | string, list?: [] }] */
export function LegalDoc({ updated, intro, sections }) {
  return (
    <section className="section">
      <div className="container doc">
        <p className="doc-updated">Last updated: {updated}</p>
        {intro && <p className="doc-intro">{intro}</p>}
        {sections.map((s, i) => (
          <div className="doc-sec" key={s.h} id={`s${i + 1}`}>
            <h2 className="doc-h">
              {i + 1}. {s.h}
            </h2>
            {[].concat(s.p || []).map((p) => (
              <p key={p}>{p}</p>
            ))}
            {s.list && (
              <ul>
                {s.list.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
