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
        a: `${N} is a premier trader evaluation platform offering skill-based programs for educational purposes. After passing our trading challenge or starting with an Instant Simulated Account, you trade simulated accounts in a realistic market environment and can unlock access to a funded account upon successful evaluation, earning performance rewards of up to ${SPLIT_SUMMARY.max}% of your simulated gains.`,
      },
      {
        q: "Do I trade real capital or live money?",
        a: `No. ${N} is strictly an educational platform. Every tier — including evaluation phases, Instant accounts, and funded-stage accounts — consists of simulated accounts with virtual funds operating in a synthetic environment, never real capital.`,
      },
      {
        q: "Who can join the evaluation program?",
        a: "Any trader 18 or older who is not a resident of a restricted jurisdiction. Identity verification (KYC) is required before your first performance reward payout.",
      },
    ],
  },
  {
    cat: "Trading Challenges & Evaluations",
    items: [
      {
        q: "Which trading challenge should I pick to get funded as a trader?",
        a: `The 2-Step trading challenge has two simulated profit targets (${two.phase1TargetPercent}% then ${two.phase2TargetPercent}%) with our lowest entry fee. The 1-Step forex evaluation program has a single ${one.phase1TargetPercent}% target. Instant Simulated Accounts have no evaluation target but maintain strict risk limits: ${inst.dailyDrawdownPercent}% daily and ${inst.overallDrawdownPercent}% static loss limits.`,
      },
      {
        q: "Is there a time limit on the trading evaluation?",
        a: `No. Our trading evaluations have no deadline or time pressure. You only need ${MINIMUM_PROFITABLE_DAYS} profitable days (each achieving at least ${PROFITABLE_DAY_THRESHOLD_PERCENT}% of the starting simulated balance) per phase, and you must execute at least one simulated trade every ${INACTIVITY_LIMIT_DAYS} calendar days.`,
      },
      {
        q: "Do the drawdown limits change once I earn access to a funded account?",
        a: `Yes. When you qualify for access to a funded account upon successful evaluation, accounts follow disciplined risk parameters: ${FUNDED_DRAWDOWN_LIMITS.dailyDrawdownPercent}% daily and ${FUNDED_DRAWDOWN_LIMITS.overallDrawdownPercent}% overall loss limits. Trades must remain open for at least ${MINIMUM_HOLDING_SECONDS / 60} minutes, and new positions must be spaced at least 5 minutes apart. Refer to the Trading Rules page for full specifications.`,
      },
      {
        q: "What happens if I breach an evaluation rule?",
        a: "The simulated account is closed and you will receive a detailed email report specifying which evaluation parameter was exceeded and at what timestamp.",
      },
      {
        q: "Can I hold trades over the weekend or trade during high-impact news?",
        a: `Overnight position holding on weekdays is permitted. Weekend holding requires the +${WEEKEND_HOLDING_ADDON_PERCENT}% add-on at checkout. News trading is unrestricted during evaluation stages; on funded-stage and Instant simulated accounts, profits from positions opened or closed within ${NEWS_RESTRICTED_MINUTES_EACH_SIDE} minutes of high-impact news are excluded from withdrawable rewards.`,
      },
    ],
  },
  {
    cat: "Performance Rewards & Payouts",
    items: [
      {
        q: "When can I request a performance reward payout?",
        a: `You may request rewards once your funded-stage or Instant simulated account meets the required profitable trading days and your KYC is verified. Traders can request up to ${WITHDRAWAL_CAP_PERCENT}% of the simulated account size in every ${PAYOUT_PERIOD_DAYS}-day period. The minimum withdrawal request is $${MIN_PAYOUT_USD}.`,
      },
      {
        q: "What is the performance reward split?",
        a: `${SPLIT_SUMMARY.first}% on your initial payout, progressing to ${SPLIT_SUMMARY.max}% by your ${SPLIT_SUMMARY.steps}rd successful payout on the same simulated account.`,
      },
      {
        q: "How are performance rewards processed?",
        a: "Via USDT (TRC20) or direct bank transfer, remitted exclusively to an account under your verified legal name. Every reward request is manually verified by the Idle4ex compliance desk prior to release.",
      },
    ],
  },
  {
    cat: "Platforms & Simulated Account Setup",
    items: [
      { q: "Which platforms are available for the prop firm evaluation?", a: `${site.platforms.join(", ")}. You select your preferred trading terminal when securing your challenge.` },
      {
        q: "Are Expert Advisors (EAs) and automated algorithms allowed?",
        a: "Yes, automated trading is permitted provided your EA complies with all evaluation criteria — including minimum trade holding times and entry spacing on funded-stage simulated accounts. High-frequency arbitrage and latency exploitation of simulated demo feeds are prohibited.",
      },
      {
        q: "How quickly do I receive my simulated account credentials?",
        a: "Once checkout is completed, our automated provisioning system generates your simulated account credentials and emails them immediately. You can also view them inside your Idle4ex dashboard under My Accounts.",
      },
    ],
  },
];

/* ── Affiliates ──────────────────────────────────────────── */
export const affiliateTiers = [
  { name: "Direct Commission", rate: "10%", req: "On every trading challenge purchased by your referrals" },
  { name: "Trader Discount", rate: "10%", req: "Instant discount applied when referrals use your code at checkout" },
  { name: "VIP Partner Tier", rate: "Custom Rate", req: "Enhanced terms for trading educators, communities, and creators" },
];

export const affiliatePerks = [
  "Instant access to your personalized referral link and coupon code upon sign-up",
  "Generous 10% commission on every evaluation purchase and retake",
  "Real-time analytics and conversion tracking in your Idle4ex dashboard",
  "Option to redeem approved affiliate commissions for new trading challenges",
  "Regular bi-weekly partner disbursements processed reliably by our team",
];

/* ── About ───────────────────────────────────────────────── */
export const values = [
  { title: "Transparent Rules", text: "Every evaluation requirement is published openly with no ambiguous clauses or hidden conditions." },
  { title: "Professional Simulation", text: "Hone and demonstrate your trading strategy in a realistic simulated market environment powered by live-feed data." },
  { title: "Trader-Focused Support", text: "24/7 technical and account assistance delivered by knowledgeable trading specialists, never generic bots." },
];

/* ── Contact ─────────────────────────────────────────────── */
export const contact = {
  email: "support@idle4ex.com",
  partners: "partners@idle4ex.com",
  hours: "Live Chat 24/7 · Email inquiries answered within 12 hours",
  address: "Idle4ex Ltd. — Educational & Simulated Trading Evaluation Platform",
};

/* ── Legal ───────────────────────────────────────────────── */
export const legalUpdated = "October 20, 2026";

export const refundPolicy = [
  {
    h: "General Refund Principles",
    p: [
      `All fees paid on ${N} are for digital access to our educational evaluation platform, proprietary risk assessment systems, and simulated trading infrastructure.`,
      "Because our automated systems instantly allocate virtual server resources and generate trading credentials upon purchase, evaluation fees are non-refundable once any simulated trading activity has commenced.",
    ],
  },
  {
    h: "14-Day Inactive Cancellation Policy (Cooling-off Period)",
    p: [
      "You have the right to cancel your challenge purchase and receive a full 100% refund within 14 calendar days from the date of payment, provided that you have NOT placed any simulated trades on the account.",
      "Once you execute your first simulated trade (whether market order or pending order) or alter the account equity in any way, the educational evaluation service is deemed fully initiated, and the 14-day cancellation right is irrevocably waived.",
    ],
  },
  {
    h: "100% Refundable Challenge Fee on First Payout",
    p: [
      `Traders who demonstrate discipline, successfully satisfy all phase objectives, and earn their first approved performance reward on a funded simulated account receive a 100% refund of their original challenge registration fee.`,
      "This reimbursement is credited directly to your payout destination alongside your performance reward share.",
    ],
  },
  {
    h: "Customizations & Add-Ons (Weekend & Overnight Holding)",
    p: [
      `Purchases of account add-ons — such as Weekend Holding (+20%) and Overnight Holding (+10%) — are tied to the specific challenge plan with which they were ordered.`,
      "If an account qualifies for a refund under the 14-day inactive policy, any associated add-on fees are refunded concurrently. Once trading has commenced, add-on fees are strictly non-refundable.",
    ],
  },
  {
    h: "Technical Failures & Platform Outages",
    p: [
      "In the rare event of a verified server-side outage, data feed disruption, or technical platform malfunction that causes an erroneous rule breach or unfair account closure, our compliance team conducts a full server log audit.",
      "If our systems confirm that a malfunction occurred through no fault of your own, we will promptly reinstate the account or issue a brand new replacement evaluation account free of charge.",
    ],
  },
  {
    h: "Chargebacks, Payment Disputes & Fraud Prevention",
    p: [
      `Initiating an unauthorized chargeback or payment retrieval without first contacting ${N} customer support is considered a material violation of our Terms of Service.`,
      "Upon notice of a dispute, all trading accounts linked to the customer are immediately frozen, pending performance rewards are forfeited, and the user's profile is permanently barred from participating in future challenges across our network.",
    ],
  },
  {
    h: "How to Request an Eligible Refund",
    p: [
      `To request a refund under the 14-day inactive cooling-off period, please contact our support team at ${contact.email} or via our 24/7 Live Chat.`,
      "Please include your registered email address, order number (e.g. o-1234), and the reason for your request. Approved refunds are processed back to the original payment method within 3 to 7 business days.",
    ],
  },
];

export const terms = [
  {
    h: "Acceptance of Terms & Relationship",
    p: [
      `By accessing the ${N} website, registering a trader profile, or purchasing any evaluation program, you acknowledge that you have read, understood, and agreed to be legally bound by these Terms of Service.`,
      `If you do not agree with any part of these terms, you must immediately discontinue using all ${N} services and websites.`,
    ],
  },
  {
    h: "Strictly Educational & Simulated Platform",
    p: [
      `${N} operates exclusively as an educational, skill-based trader evaluation platform. Under no circumstances does ${N} provide banking, custodial, asset management, or fiduciary advice.`,
      "All accounts provided — across 1-Step, 2-Step, Instant, and funded stages — are simulated demo accounts operating with virtual currency in a synthetic trading environment.",
      "All trading is conducted on simulated accounts with virtual funds for educational purposes. Fees paid represent access charges for skill-based programs and evaluation infrastructure, not capital deposits.",
    ],
  },
  {
    h: "User Eligibility, Identity Verification (KYC) & Single Profile Rule",
    p: [
      "To use our services, you must be at least 18 years of age (or the age of legal majority in your jurisdiction) and possess the full legal capacity to enter into binding agreements.",
      "Each trader is permitted to create and maintain exactly one client profile. Account sharing, account selling, or trading through another individual's identity is strictly prohibited.",
      "Before any performance reward payout is approved, you must successfully complete identity verification (KYC) through our verified compliance partner.",
    ],
    list: [
      "Residents of restricted jurisdictions (including OFAC sanctioned countries) are strictly prohibited from using the platform.",
      "Accounts registered with false or misleading personal data will be terminated immediately with forfeiture of all fees.",
      "You are solely responsible for maintaining the confidentiality of your login credentials.",
    ],
  },
  {
    h: "Evaluation Programs, Stages & Add-Ons",
    p: [
      `${N} offers various simulated evaluation tiers, including 1-Step Challenge, 2-Step Challenge, and Instant Simulated Accounts.`,
      "Traders may customize their challenge by purchasing optional add-ons, such as Weekend Holding (+20%) and Overnight Holding (+10%). These add-ons grant explicit exemptions from standard intraday/weekend position closure rules.",
      "The specific parameters for each plan (profit targets, daily loss limits, maximum total loss limits) are published in our live catalog and are immutable for the duration of that account's life cycle.",
    ],
  },
  {
    h: "Prohibited Trading Practices",
    p: [
      "To ensure fair and rigorous evaluations, certain deceptive or exploitative strategies are strictly banned across all accounts:",
    ],
    list: [
      "Latency arbitrage, price feed manipulation, or exploiting platform software glitches.",
      "High-frequency tick scalping (holding positions under 10 seconds repeatedly).",
      "Account reverse trading or cross-hedging between multiple accounts.",
      "Use of public, shared, or commercial copy-trading signals without verifiable personal execution.",
    ],
  },
  {
    h: "Performance Rewards & Withdrawal Conditions",
    p: [
      "Traders who complete evaluation stages and demonstrate sustained discipline on funded simulated accounts are eligible to receive performance-based rewards.",
      "Performance rewards represent contractual incentives based on simulated performance and do not constitute dividends, interest, or return on invested capital.",
    ],
  },
];

export const privacy = [
  {
    h: "Information We Collect",
    p: "We collect personal data required to register your account, verify your identity (KYC), process payments, and monitor evaluation progress. This includes your name, email, country of residence, identification documents, and simulated trading statistics.",
  },
  {
    h: "How We Use Your Data",
    p: "Your information is used to provide access to our simulated trading platform, evaluate compliance with trading rules, disburse performance rewards, prevent fraudulent activity, and communicate essential service updates.",
  },
  {
    h: "Data Protection & Security",
    p: "We implement industry-standard encryption, strict access controls, and regular security audits to safeguard your personal information and trading analytics from unauthorized access or disclosure.",
  },
  {
    h: "Third-Party Sharing",
    p: "We do not sell your personal information. Data is shared exclusively with verified service partners strictly necessary for platform operations, including KYC identity verification providers, payment processors, and hosting infrastructure.",
  },
];

export const riskDisclosure = [
  {
    h: "Educational Evaluation Platform Only",
    p: `${N} is an educational and trader evaluation platform. All accounts provided across all stages — including evaluation challenges, Instant accounts, and funded stages — are demo accounts with virtual, simulated funds operating in a simulated environment. Users never trade real capital, and no orders are routed to real-money markets.`,
  },
  {
    h: "Simulated Execution vs. Real-Money Markets",
    p: "Hypothetical or simulated trading performance has inherent limitations. Unlike an actual performance record in live financial markets, simulated results do not represent actual trading with real capital. Because trades are executed in a synthetic market environment, results may under- or over-compensate for factors such as real market liquidity, slippage, and order book depth.",
  },
  {
    h: "Independent Educational & Evaluation Platform",
    p: `${N} operates strictly as an independent evaluation platform for educational purposes. Fees paid to ${N} grant access to simulated accounts, performance analytics, and skill-based evaluation technology — they are never client deposits, capital allocations, or margin funds.`,
  },
  {
    h: "No Financial or Trading Advice",
    p: `Nothing on the ${N} website, trader portal, dashboards, emails, or community channels constitutes personalized financial, legal, or tax advice. All content is provided strictly for educational purposes and skill evaluation.`,
  },
  {
    h: "Past Performance Disclaimer",
    p: "Past simulated performance, including published trader evaluation results and reward figures, is not indicative of future results in any simulated or actual trading environment.",
  },
  {
    h: "Restricted Jurisdictions",
    p: "Our educational evaluation services are not offered where they would be contrary to local law or regulation. It is your responsibility to ensure you are permitted to use them in your jurisdiction.",
  },
];

export const risk = riskDisclosure;

