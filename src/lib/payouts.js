// Payout certificates shown on the home page strip and the /payouts page.
// To add one: drop the image in /public/payouts and add a row here (newest first).
export const PAYOUTS = [
  { name: "Saeed Al Mazrouei", country: "United Arab Emirates", amount: 1847, date: "2026-11-19", img: "/payouts/saeed-al-mazrouei.webp" },
  { name: "James Mitchell", country: "United Kingdom", amount: 2936, date: "2026-11-18", img: "/payouts/james-mitchell.webp" },
  { name: "Leon Fischer", country: "Germany", amount: 2541, date: "2026-11-18", img: "/payouts/leon-fischer.webp" },
  { name: "Vikram Singh", country: "India", amount: 1215, date: "2026-11-18", img: "/payouts/vikram-singh.webp" },
  { name: "Pedro Oliveira", country: "Brazil", amount: 823, date: "2026-11-18", img: "/payouts/pedro-oliveira.webp" },
  { name: "Hans Becker", country: "Germany", amount: 2176, date: "2026-11-17", img: "/payouts/hans-becker.webp" },
  { name: "Faisal Al Nuaimi", country: "United Arab Emirates", amount: 1759, date: "2026-11-17", img: "/payouts/faisal-al-nuaimi.webp" },
  { name: "Noah Bennett", country: "United States", amount: 648, date: "2026-11-17", img: "/payouts/noah-bennett.webp" },
  { name: "Arjun Patel", country: "India", amount: 1482, date: "2026-11-16", img: "/payouts/arjun-patel.webp" },
  { name: "Mateo Costa", country: "Brazil", amount: 934, date: "2026-11-16", img: "/payouts/mateo-costa.webp" },
];

export const fmtUsd = (n) => `$${n.toLocaleString("en-US")}`;
export const fmtDate = (d) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
