// ─────────────────────────────────────────────────────────────
//  INNER-PAGE COPY — FAQ, affiliates, about, contact, legal.
//  Rule and payout NUMBERS are not written here: they come from
//  src/lib/publicRules.ts, which reads the backend's own rulebook,
//  and prices come live from the pricing_plans table. Only edit
//  wording here; change rules in src/lib/rulebook.ts.
// ─────────────────────────────────────────────────────────────
import { site } from "./site.config";
import {
  CHALLENGE_RULES,
  FUNDED_DRAWDOWN_LIMITS,
  INACTIVITY_LIMIT_DAYS,
  NEWS_RESTRICTED_MINUTES_EACH_SIDE,
  WEEKEND_HOLDING_ADDON_PERCENT,
} from "./lib/rulebook";
import { MIN_PAYOUT_USD, PAYOUT_PERIOD_DAYS, SPLIT_SUMMARY, WITHDRAWAL_CAP_PERCENT } from "./lib/publicRules";
import { MINIMUM_HOLDING_SECONDS, MINIMUM_PROFITABLE_DAYS, PROFITABLE_DAY_THRESHOLD_PERCENT } from "./lib/accountTradingRules";

const N = site.name;
const two = CHALLENGE_RULES.two_step_standard;
const one = CHALLENGE_RULES.one_step_pro;
const inst = CHALLENGE_RULES.instant_funding;

/* ── FAQ ─────────────────────────────────────────────────── */
export const faq = [
  {
    cat: "General & Simulated Environment",
    items: [
      {
        q: `What is ${N}?`,
        a: `${N} is an educational and trader skill-evaluation platform. After passing a simulated evaluation (or starting with an Instant Simulated Account), you trade simulated capital in a realistic simulated market environment and can earn performance rewards of up to ${SPLIT_SUMMARY.max}% of your simulated gains.`,
      },
      {
        q: "Do I trade real capital or live money?",
        a: `No. ${N} is strictly an educational and evaluation platform. Every account — including evaluation phases, Instant accounts, and "funded" stage accounts — is a demo account with virtual, simulated funds operating in a simulated environment, never real capital.`,
      },
      {
        q: "Who can join?",
        a: "Anyone 18 or older who is not a resident of a restricted jurisdiction. Identity verification (KYC) is required before your first performance reward payout.",
      },
    ],
  },
  {
    cat: "Challenges",
    items: [
      {
        q: "Which challenge should I pick?",
        a: `The 2-Step has two simulated targets (${two.phase1TargetPercent}% then ${two.phase2TargetPercent}%) and the lowest fee. The 1-Step has a single ${one.phase1TargetPercent}% target. Instant Simulated Accounts have no evaluation target but tighter limits: ${inst.dailyDrawdownPercent}% daily and ${inst.overallDrawdownPercent}% overall.`,
      },
      {
        q: "Is there a time limit?",
        a: `No. Evaluations have no deadline. You only need ${MINIMUM_PROFITABLE_DAYS} profitable days (each at least ${PROFITABLE_DAY_THRESHOLD_PERCENT}% of the starting simulated balance) per phase, and you must place at least one simulated trade every ${INACTIVITY_LIMIT_DAYS} days.`,
      },
      {
        q: "Do the limits change once I reach the funded stage?",
        a: `Yes. Funded-stage simulated accounts use ${FUNDED_DRAWDOWN_LIMITS.dailyDrawdownPercent}% daily and ${FUNDED_DRAWDOWN_LIMITS.overallDrawdownPercent}% overall loss limits, trades must stay open at least ${MINIMUM_HOLDING_SECONDS / 60} minutes, and new trades must be at least 5 minutes apart. See the Trading Rules page for every detail.`,
      },
      {
        q: "What happens if I break a rule?",
        a: "The simulated account is closed and you receive an email explaining which evaluation rule was breached and when.",
      },
      {
        q: "Can I hold trades over the weekend or trade the news?",
        a: `Overnight holding on weekdays is always allowed. Weekend holding needs the +${WEEKEND_HOLDING_ADDON_PERCENT}% add-on at checkout. News trading is free during evaluations; on funded-stage and Instant simulated accounts, gains from trades opened or closed within ${NEWS_RESTRICTED_MINUTES_EACH_SIDE} minutes of high-impact news are not eligible for withdrawal.`,
      },
    ],
  },
  {
    cat: "Payouts & Rewards",
    items: [
      {
        q: "When can I request a performance reward payout?",
        a: `Once your funded-stage or Instant simulated account has the required profitable days and your KYC is approved. You can request up to ${WITHDRAWAL_CAP_PERCENT}% of the simulated account size in every ${PAYOUT_PERIOD_DAYS}-day period. The minimum request is $${MIN_PAYOUT_USD}.`,
      },
      {
        q: "What is the reward split?",
        a: `${SPLIT_SUMMARY.first}% on your first payout, rising to ${SPLIT_SUMMARY.max}% by your ${SPLIT_SUMMARY.steps}rd payout on the same simulated account.`,
      },
      {
        q: "How are payouts sent?",
        a: "In USDT (TRC20) or by bank transfer, only to an account in your own verified name. Each request is reviewed by the Idle4ex team before it is sent.",
      },
    ],
  },
  {
    cat: "Platforms & Account",
    items: [
      { q: "Which platforms can I use?", a: `${site.platforms.join(", ")}. You choose one when you purchase a challenge.` },
      {
        q: "Can I use EAs?",
        a: "Yes, as long as the EA follows every rule — including the minimum holding time and trade spacing on funded-stage simulated accounts. Strategies that exploit latency or the simulated demo price feed are prohibited.",
      },
      {
        q: "How do I get my login details?",
        a: "After payment is confirmed we prepare your simulated trading account and email the login credentials. They also appear in your Idle4ex dashboard under My Accounts.",
      },
    ],
  },
];

/* ── Affiliates ──────────────────────────────────────────── */
export const affiliateTiers = [
  { name: "Commission", rate: "10%", req: "On every challenge your referrals buy" },
  { name: "Their discount", rate: "10%", req: "Off when they use your code at checkout" },
  { name: "Custom rate", rate: "Talk to us", req: "For large communities and creators" },
];

export const affiliatePerks = [
  "Your referral link and code are ready the moment you sign up",
  "Commission on every purchase, retakes included",
  "Live referrals and earnings in your Idle4ex dashboard",
  "Approved commission can be spent on your own challenges",
  "Commission payouts reviewed and sent by our team",
];

/* ── About ───────────────────────────────────────────────── */
export const values = [
  { title: "Clear rules", text: "Every evaluation rule fits on one page. If something is not written down, it is not a rule." },
  { title: "Realistic simulation", text: "Practice and prove your discipline in a simulated market environment with live-feed pricing." },
  { title: "Real support", text: "Questions are answered by people who understand trading, not scripts, 24 hours a day." },
];

/* ── Contact ─────────────────────────────────────────────── */
export const contact = {
  email: "support@idle4ex.com",
  partners: "partners@idle4ex.com",
  hours: "Live chat 24/7 · Email replies within 12 hours",
  address: "Idle4ex Ltd. — Educational & Simulated Trading Platform",
};

/* ── Legal ───────────────────────────────────────────────── */
export const legalUpdated = "October 18, 2026";

export const terms = [
  {
    h: "Acceptance",
    p: `By creating an account or purchasing an evaluation on ${N}, you agree to these Terms of Service. If you do not agree, do not use ${N}'s educational and simulated trading services.`,
  },
  {
    h: "Educational & Simulated Nature of the Service",
    p: `${N} is strictly an educational and trader skill-evaluation platform. All accounts provided (including 1-Step, 2-Step, Instant, and funded-stage accounts) are demo accounts funded exclusively with virtual, simulated funds in a simulated trading environment — NOT real capital. No trades are executed in live financial markets on your behalf, and no service provided by ${N} is investment advice, asset management, or a brokerage service.`,
  },
  {
    h: "Eligibility",
    p: "You must be at least 18 years old, provide accurate information, and pass identity verification (KYC) before receiving any performance reward.",
    list: [
      "You may not be a resident of a restricted jurisdiction.",
      "You may hold only one client profile.",
      "Simulated accounts are personal and may not be traded by anyone else.",
    ],
  },
  {
    h: "Evaluation Fees and Refunds",
    p: "Challenge fees are paid for access to the Idle4ex educational evaluation platform and simulated trading environment. Fees are charged once at purchase and are non-refundable once any simulated trade has been placed on the account.",
  },
  {
    h: "Simulated Trading Rules",
    p: "Every account is subject to the Trading Rules published on our website. Breaching a hard rule closes the simulated account. We may update the rules for new purchases with notice; existing accounts keep the rules in place when purchased.",
  },
  {
    h: "Performance Rewards (Payouts)",
    p: "Performance rewards are calculated from the simulated performance of your verified demo account and are governed by the Payout Policy. We may withhold a payout while investigating a suspected breach or prohibited trading strategy.",
  },
  {
    h: "Termination",
    p: "We may suspend or close accounts that breach these terms, the trading rules, or applicable law. You may close your profile at any time from your dashboard.",
  },
  {
    h: "Liability",
    p: `To the extent permitted by law, ${N}'s total liability is limited to the evaluation fees you paid in the 12 months before a claim.`,
  },
  {
    h: "Governing Law",
    p: `These terms are governed by the laws of the jurisdiction of ${site.company}'s registered office.`,
  },
];

export const privacy = [
  {
    h: "Data we collect",
    p: "We collect the information needed to run your simulated evaluation account and process performance rewards.",
    list: [
      "Identity: name, date of birth, ID documents (for KYC)",
      "Contact: email, phone, country",
      "Account: simulated trading activity, payout history",
      "Technical: IP address, device and browser data, cookies",
    ],
  },
  {
    h: "How we use it",
    p: "To provide and secure the educational platform, verify identity, process evaluation fees and performance rewards, prevent fraud, meet legal obligations, and — only with your consent — send marketing.",
  },
  {
    h: "Sharing",
    p: "We share data only with processors that help us run the service: payment providers, identity verification, simulated trading platform providers, email, and hosting. We never sell personal data.",
  },
  {
    h: "Retention",
    p: "We keep account and transaction records for as long as the law requires (typically 5–7 years) and delete or anonymise other data when it is no longer needed.",
  },
  {
    h: "Your rights",
    p: "Depending on where you live you may access, correct, export, or delete your data, and object to or restrict processing. Contact us to exercise these rights.",
  },
  {
    h: "Cookies",
    p: "We use essential cookies to keep you signed in, and analytics cookies only with your consent. You can change your choice at any time.",
  },
  { h: "Contact", p: `Questions about privacy: ${contact.email}.` },
];

export const risk = [
  {
    h: "Educational & Simulated Trading Environment Only",
    p: `${N} is an educational and trader evaluation platform. All accounts provided across all stages — including evaluation challenges, Instant accounts, and "funded" stages — are demo accounts with virtual, simulated funds operating in a simulated environment. Users never trade real capital, and no orders are routed to live financial markets.`,
  },
  {
    h: "Simulated Execution vs. Live Markets",
    p: "Hypothetical or simulated trading performance has inherent limitations. Unlike an actual performance record in live markets, simulated results do not represent actual trading with real capital. Because trades are not executed in a live market, results may under- or over-compensate for the impact of market factors such as lack of liquidity, slippage, and order book depth.",
  },
  {
    h: "No Brokerage or Investment Services",
    p: `${N} is not a broker, dealer, financial institution, or investment advisor. Evaluation fees paid to ${N} are subscription/access fees for educational assessment and simulated trading technology — they are never client deposits, investments, or margin funds.`,
  },
  {
    h: "No Investment Advice",
    p: `Nothing on the ${N} website, trader portal, dashboards, emails, or community channels constitutes investment, financial, legal, or tax advice. You are solely responsible for your own decisions.`,
  },
  {
    h: "Past Performance",
    p: "Past simulated performance, including published trader evaluation results and reward figures, is not indicative of future results in either simulated or live trading.",
  },
  {
    h: "Restricted Jurisdictions",
    p: "Our educational evaluation services are not offered where they would be contrary to local law or regulation. It is your responsibility to ensure you are permitted to use them in your jurisdiction.",
  },
];
