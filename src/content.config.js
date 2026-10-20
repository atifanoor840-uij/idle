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
export const legalUpdated = "October 20, 2026";

export const refundPolicy = [
  {
    h: "General Refund Principles",
    p: [
      `All fees paid on ${N} are for digital access to our educational evaluation platform, proprietary risk assessment systems, and simulated trading infrastructure.`,
      "Because our automated systems instantly allocate virtual server resources and generate trading credentials upon purchase, evaluation fees are generally non-refundable once any simulated trading activity has commenced.",
    ],
  },
  {
    h: "14-Day Inactive Cancellation Policy (Cooling-off Period)",
    p: [
      "You have the right to cancel your challenge purchase and receive a full 100% refund within 14 calendar days from the date of payment, provided that you have NOT placed any simulated trades on the account.",
      "Once you execute your first simulated trade (whether buy or sell, open or pending) or alter the account equity in any way, the educational evaluation service is deemed fully initiated, and the 14-day cancellation right is irrevocably waived.",
    ],
  },
  {
    h: "100% Refundable Challenge Fee on First Payout",
    p: [
      `Traders who demonstrate discipline, successfully satisfy all phase objectives, and earn their first approved performance reward on a funded simulated account receive a 100% refund of their original challenge registration fee.`,
      "This refund is credited directly to your payout destination alongside your performance reward share.",
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
      "In the rare event of a verified server-side outage, broker infrastructure disruption, or technical platform malfunction that causes an erroneous rule breach or unfair account closure, our compliance team conducts a full server log audit.",
      "If our systems confirm that a malfunction occurred through no fault of your own, we will promptly reinstate the account or issue a brand new replacement evaluation account free of charge.",
    ],
  },
  {
    h: "Chargebacks, Payment Disputes & Fraud Prevention",
    p: [
      `Initiating an unauthorized chargeback, payment retrieval, or payment dispute with your bank, credit card company, or crypto gateway without first contacting ${N} customer support is considered a material violation of our Terms of Service.`,
      "Upon notice of a chargeback, all trading accounts linked to the customer are immediately frozen, pending performance rewards are forfeited, and the user's profile is permanently banned from participating in future challenges across our network.",
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
    h: "Strictly Educational & Simulated Platform (No Brokerage Services)",
    p: [
      `${N} operates exclusively as an educational, gamified trader skill-evaluation platform. Under no circumstances does ${N} act as a broker, dealer, financial institution, custodian, or investment advisor.`,
      "All accounts provided — across 1-Step, 2-Step, Instant, and funded stages — are simulated demo accounts operating with virtual currency in a synthetic trading environment.",
      "No actual financial market orders are executed on your behalf, and no client capital is invested in real markets. Fees paid represent access charges for educational evaluation infrastructure and do not constitute investment deposits.",
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
    h: "Trading Rules & Risk Management Compliance",
    p: [
      "Every evaluation account must adhere strictly to the rules published on our Trading Rules page at all times.",
      "Breaching any hard limit — including the Daily Drawdown limit, Overall Maximum Loss limit, or Minimum Holding Time on funded accounts — results in the immediate failure and termination of the simulated account.",
    ],
  },
  {
    h: "Prohibited Trading Strategies & System Exploits",
    p: [
      `${N} rewards genuine trading skill and disciplined risk management. Any strategy designed to exploit demo server architecture, price feed discrepancies, or synthetic execution models is strictly prohibited.`,
    ],
    list: [
      "Latency arbitrage, price feed manipulation, and gap trading exploitation.",
      "High-frequency tick scalping (holding trades under the required minimum duration).",
      "Account passing services, automated bots designed for latency exploits, and signal mirroring across unrelated accounts.",
      "Trade layering and excessive margin flooding designed to overwhelm simulated risk engines.",
    ],
  },
  {
    h: "Performance Rewards & Profit Sharing",
    p: [
      "Traders who pass the evaluation stages and enter the funded stage are eligible to request performance rewards calculated as a percentage (up to 90%) of virtual profits generated in the simulated environment.",
      "Payouts are subject to our Payout Policy, including identity verification, minimum profitable day requirements, and regular review intervals.",
      "Idle4ex reserves the right to conduct a compliance audit on any payout request to ensure full adherence to our trading guidelines.",
    ],
  },
  {
    h: "Refund Policy",
    p: [
      "All challenge purchases are governed by our Refund Policy. Unused evaluation accounts with zero trades placed are eligible for a 100% refund within 14 days of purchase. Once trading has begun, fees are strictly non-refundable.",
    ],
  },
  {
    h: "Intellectual Property Rights",
    p: [
      `All content, visual interfaces, logos, graphics, software, code, and documentation associated with ${N} are the exclusive intellectual property of ${site.company} and are protected by applicable copyright, trademark, and intellectual property laws.`,
    ],
  },
  {
    h: "Limitation of Liability & Warranty Disclaimer",
    p: [
      `To the maximum extent permitted by applicable law, ${N} and its officers, directors, employees, and affiliates shall not be liable for any indirect, incidental, punitive, or consequential damages arising out of your use or inability to use the platform.`,
      `In all circumstances, ${N}'s total aggregate liability shall not exceed the actual fees paid by you to ${N} during the six (6) months immediately preceding the event giving rise to liability.`,
    ],
  },
  {
    h: "Indemnification",
    p: [
      `You agree to defend, indemnify, and hold harmless ${site.company}, its officers, and affiliates from and against any claims, damages, liabilities, costs, or expenses arising from your violation of these Terms of Service or your unauthorized use of the platform.`,
    ],
  },
  {
    h: "Governing Law & Dispute Resolution",
    p: [
      `These Terms of Service and any dispute arising out of or related to them shall be governed by and construed in accordance with the laws of the jurisdiction of ${site.company}'s registration, without regard to conflict of law principles.`,
      "Any dispute that cannot be resolved through informal negotiation shall be submitted to the competent courts of that jurisdiction.",
    ],
  },
];

export const privacy = [
  {
    h: "Introduction & Overview",
    p: [
      `${site.company} ("${N}", "we", "us", or "our") respects your privacy and is dedicated to protecting your personal data.`,
      "This Privacy Policy outlines how we collect, process, disclose, and safeguard your personal data when you visit our website, register for an account, or interact with our educational evaluation services in compliance with the General Data Protection Regulation (GDPR) and other applicable data privacy laws.",
    ],
  },
  {
    h: "Categories of Personal Data We Collect",
    p: [
      "We collect and process only the personal information strictly necessary to provide, manage, and secure our educational evaluation platform.",
    ],
    list: [
      "Identity Data: Full legal name, date of birth, nationality, government-issued photo identification, and facial biometrics collected during KYC verification.",
      "Contact Data: Email address, phone number, residential address, and country of residence.",
      "Financial & Payment Data: Payment method details, cardholder name, masked credit card digits, transaction IDs, crypto wallet public addresses, and payout banking information.",
      "Trading Activity Data: Simulated trade orders, timestamps, entry/exit prices, trading volumes, drawdown metrics, and performance statistics.",
      "Technical & Usage Data: IP address, geolocation estimates, browser type, device specifications, operating system, log files, session duration, and cookie identifiers.",
    ],
  },
  {
    h: "Legal Bases & Purposes for Data Processing",
    p: [
      "We process your personal information under the following recognized legal bases:",
      "1. Performance of Contract: To provision your simulated accounts, deliver login credentials, track trading metrics, and process eligible performance payouts.",
      "2. Legal & Regulatory Compliance: To prevent fraud, verify trader identity under Anti-Money Laundering (AML) standards, comply with tax reporting obligations, and enforce sanctions restrictions.",
      "3. Legitimate Interests: To detect malicious trading exploits, secure our cloud infrastructure, improve user experience, and conduct operational analytics.",
      "4. Explicit Consent: For sending promotional newsletters, platform updates, and non-essential analytical cookies (which you may withdraw at any time).",
    ],
  },
  {
    h: "Data Sharing & Third-Party Processors",
    p: [
      "We never sell, rent, or trade your personal data to advertisers or third-party marketers. We share data solely with trusted service providers necessary for operating our platform:",
    ],
    list: [
      "Payment Processors: Stripe, Paddle, NOWPayments, and CodaPay for secure transaction processing.",
      "Identity Verification Partners: Didit and licensed compliance providers for automated identity verification.",
      "Trading Platform Infrastructure: MetaQuotes (MT4/MT5), Spotware (cTrader), and dedicated demo server providers.",
      "Communication & Support: Email delivery infrastructure and customer support chat software.",
      "Legal & Regulatory Authorities: When strictly mandated by court orders, lawful subpoenas, or regulatory enforcement.",
    ],
  },
  {
    h: "International Data Transfers",
    p: [
      "Because our infrastructure and service providers operate internationally, your data may be transferred to and maintained on secure servers outside your country of residence.",
      "Whenever data is transferred across international borders, we ensure adequate protections are in place through Standard Contractual Clauses (SCCs) approved by the European Commission or equivalent regulatory frameworks.",
    ],
  },
  {
    h: "Data Security & Storage Safeguards",
    p: [
      "We implement robust administrative, technical, and physical security measures to safeguard your personal data against unauthorized access, loss, alteration, or disclosure.",
      "These protections include end-to-end TLS encryption in transit, AES-256 encryption at rest, multi-factor administrative access, and regular vulnerability scanning.",
    ],
  },
  {
    h: "Data Retention Schedule",
    p: [
      "We retain your personal information only for as long as necessary to fulfill the purposes for which it was collected, maintain your trading profile, or comply with statutory accounting and legal retention mandates (typically 5 to 7 years for financial records).",
      "When personal data is no longer required, it is securely destroyed or irreversibly anonymized.",
    ],
  },
  {
    h: "Your Legal Rights Under GDPR & International Privacy Laws",
    p: [
      "Depending on your jurisdiction, you possess specific rights regarding your personal information:",
    ],
    list: [
      "Right to Access: You may request a copy of the personal information we hold about you.",
      "Right to Rectification: You may request correction of inaccurate or incomplete personal records.",
      "Right to Erasure ('Right to be Forgotten'): You may request deletion of your personal data where statutory retention grounds no longer apply.",
      "Right to Restrict or Object: You may restrict or object to certain forms of data processing.",
      "Right to Data Portability: You may request the export of your data in a structured, machine-readable format.",
      "Right to Withdraw Consent: You may revoke consent for marketing communications or optional cookies at any time.",
    ],
  },
  {
    h: "Cookies & Tracking Technologies",
    p: [
      "We use cookies to maintain active sessions, remember user preferences, and analyze platform traffic. Essential cookies cannot be disabled as they are required for site security and functionality. Analytical cookies can be managed directly in your browser settings.",
    ],
  },
  {
    h: "Contact Information & Data Protection Officer",
    p: [
      `If you have any questions, concerns, or requests regarding this Privacy Policy or how your personal information is handled, please contact our Data Protection team at ${contact.email}.`,
    ],
  },
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
