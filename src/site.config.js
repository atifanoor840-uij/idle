// ─────────────────────────────────────────────────────────────
//  BRAND CONFIG — Idle4ex Educational & Simulated Trading Platform
// ─────────────────────────────────────────────────────────────

export const site = {
  name: "Idle4ex",
  wordmark: "IDLE4EX",
  tagline: ["Educational trading", "evaluation"],
  company: "Idle4ex Ltd.",
  year: 2026,

  links: {
    start: "/pricing",
    login: "/dashboard",
    trial: null,
    platform: "#",
    discord: "#",
    contact: "/contact",
  },

  promo: { text: "Instant Simulated Accounts are live", href: "/pricing#instant" },
  sponsorship: { text: "Sponsorship", href: "#" },

  nav: [
    { label: "Quickstart", href: "/#steps" },
    { label: "Pricing", href: "/pricing" },
    { label: "Rules", href: "/rules" },
    { label: "Platforms", href: "/#platforms" },
  ],
  navMore: [
    { label: "Payout Policy", href: "/payout-policy" },
    { label: "Refund Policy", href: "/refund-policy" },
    { label: "FAQ", href: "/faq" },
    { label: "Affiliates", href: "/affiliates" },
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],

  heroSlides: [
    {
      title: "Trade **Simulated Capital**.\nKeep Up To **90%**.",
      sub: "Pass one simple evaluation and trade up to $200K in a realistic simulated environment.",
    },
    {
      title: "Rewarded Every\n**14 Days**.",
      sub: "Withdraw up to 6% of your simulated account size each period once you are verified.",
    },
    {
      title: "Rules You Can\n**Actually Read**.",
      sub: "No hidden clauses. Every limit our evaluation system enforces is published on one page.",
    },
  ],

  heroStats: [
    { num: "90%", lbl: "Reward split" },
    { num: "$200K", lbl: "Max simulated size" },
    { num: "14-Day", lbl: "Reward cycle" },
    { num: "2 Step / 1 Step", lbl: "Evaluation" },
    { num: "24/7", lbl: "Support" },
  ],

  quoteBand: {
    title: "Real Market Conditions",
    text: "Practice and prove your edge on live-feed market prices with raw spreads in a simulated environment — the exact same conditions across every evaluation stage.",
  },

  feature: {
    ghost: "90",
    title: "Reward split\nup to **90%**",
    items: ["80% on your first performance reward", "85% on the second, 90% from the third"],
    cta: "View Challenges",
  },
  featureHalf: [
    {
      icon: "wallet",
      title: "Fast Rewards",
      items: ["Request every 14 days", "Up to 6% of simulated account size per period", "Reviewed by a real person"],
      cta: "Payout Policy",
      href: "/payout-policy",
    },
    {
      icon: "timer",
      title: "Transparent Rules",
      items: ["No time limits on evaluation", "News trading free during evaluation", "One-page rulebook"],
      cta: "Read the Rules",
      href: "/rules",
    },
  ],

  proof: {
    stats: [
      { num: "< 24h", lbl: "Average review time" },
      { pre: "Excellent", num: "4.8/5", lbl: "Average trader rating" },
    ],
    title: "Reviewed Fast.\nProven Daily.",
    text: "Every reward request is reviewed by a real person and processed the same day. Our traders rate Idle4ex on speed, transparency and support — not marketing.",
  },

  platforms: ["MetaTrader 5", "MetaTrader 4", "cTrader"],
  devices: ["Windows", "Web Browser", "Android", "MAC", "iOS"],

  markets: ["Forex", "Commodities", "Indices", "Stocks", "Crypto", "Metals", "Futures"],

  numbers: {
    title: "Your Split Grows\nTo **90%**",
    text: "Every payout on the same simulated account raises your share: 80% on the first, 85% on the second and 90% from the third onward.",
    stats: [
      { num: "$12.4M+", lbl: "Rewards paid out" },
      { num: "38,000+", lbl: "Evaluated traders" },
    ],
  },

  payouts: {
    title: "Your Rewards, Your Way",
    items: ["Crypto (USDT TRC20)", "Bank Transfer"],
    note: "Minimum payout $100.",
    noteLink: "See payout rules",
  },
  payments: ["VISA", "Mastercard", "Apple Pay", "Google Pay", "Bitcoin", "USDT"],

  steps: [
    { title: "Choose Challenge", text: "Pick a simulated account size from $5K to $200K and a 1-Step or 2-Step model." },
    { title: "Pass Evaluation", text: "Hit the simulated profit target while respecting daily and max drawdown rules." },
    { title: "Get Verified", text: "Complete the evaluation and receive your simulated funded-stage account login by email." },
    { title: "Earn Rewards", text: "Verify your identity once, then request up to 90% of your simulated gains every 14 days." },
  ],

  app: {
    title: "Your Account,\nIn Your Pocket",
    items: ["Live drawdown & target tracking", "Instant reward notifications", "Manage every simulated account in one place"],
  },

  banner: { text: "Join 20,000+ traders on the Idle4ex Discord — educational sessions every week.", cta: "Join Discord" },

  finalCta: {
    title: "Ready To Start Your Evaluation?",
    sub: "Pick a simulated account size, pass the evaluation, and earn performance rewards.",
  },

  footer: {
    mission:
      "Idle4ex is an educational and trader evaluation platform. We provide disciplined traders with simulated accounts in a realistic market environment and reward proven skill with clear, transparent rules.",
    social: [
      { icon: "x", href: "#", label: "X" },
      { icon: "instagram", href: "#", label: "Instagram" },
      { icon: "facebook", href: "#", label: "Facebook" },
    ],
    columns: [
      {
        title: "Challenges",
        links: [
          { label: "2-Step Challenge", href: "/pricing#2-step" },
          { label: "1-Step Challenge", href: "/pricing#1-step" },
          { label: "Instant Account", href: "/pricing#instant" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "About Us", href: "/about" },
          { label: "Affiliates", href: "/affiliates" },
          { label: "Contact Us", href: "/contact" },
          { label: "Client Login", href: "/dashboard" },
        ],
      },
      {
        title: "Resources & Legal",
        links: [
          { label: "Trading Rules", href: "/rules" },
          { label: "Payout Policy", href: "/payout-policy" },
          { label: "Refund Policy", href: "/refund-policy" },
          { label: "Terms of Service", href: "/terms" },
          { label: "Privacy Policy", href: "/privacy" },
          { label: "Risk Disclosure", href: "/risk-disclosure" },
          { label: "FAQ", href: "/faq" },
        ],
      },
    ],
    educationalDisclaimer:
      "Idle4ex is strictly an educational and trader skill-evaluation platform. All trading accounts, challenges, and funded-stage accounts provided to users are demo accounts with virtual, simulated funds operating exclusively in a simulated trading environment — NOT real capital. No user trades are executed in live financial markets, and Idle4ex does not act as a broker, dealer, financial advisor, or asset manager.",
    riskWarning:
      "All trading activity on Idle4ex takes place in a simulated environment for educational and evaluation purposes only. Market quotes and price feeds are used solely to simulate market conditions. Any fees paid are for access to our educational evaluation platform and simulated trading infrastructure, not client deposits or investments. Past simulated performance is not indicative of future results, and nothing on this platform constitutes financial, investment, legal, or tax advice.",
    restricted:
      "Idle4ex does not offer simulated evaluation services to residents of jurisdictions where such services would be contrary to local law or regulation. See our Terms of Service for the full list.",
  },
};
