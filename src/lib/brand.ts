// Single source for firm branding used by the backend (emails, notifications, gateway URLs).
// Name comes from site.config.js so the marketing site and backend never disagree.
import { site } from "@/site.config";

export const BRAND_NAME: string = site.name;

// Hardcoded live domain: every email/link points here, never localhost.
export const APP_URL = "https://idle4ex.site";

export const SUPPORT_EMAIL = "support@idle4ex.site";

/** Slug for machine identifiers (user agents, gateway external ids). */
export const BRAND_SLUG = BRAND_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-");
