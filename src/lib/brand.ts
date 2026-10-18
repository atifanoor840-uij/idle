// Single source for firm branding used by the backend (emails, notifications, gateway URLs).
// Name comes from site.config.js so the marketing site and backend never disagree.
import { site } from "@/site.config";

export const BRAND_NAME: string = site.name;

export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.APP_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");

export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "";

/** Slug for machine identifiers (user agents, gateway external ids). */
export const BRAND_SLUG = BRAND_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-");
