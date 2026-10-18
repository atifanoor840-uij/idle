/**
 * Tiny in-process cache for catalog GET routes.
 *
 * Pricing plans, coupons and offers are admin-managed, identical for every
 * visitor and read on every visit to the Buy Challenge tab. Without this, each
 * visit costs a fresh Supabase round trip per list even though the rows change
 * a handful of times a month. The cache lives in module scope, so it is per
 * server instance and disappears on redeploy - admin writes bust their own
 * instance immediately, and any other instance is at most `ttlMs` behind.
 *
 * Only use this for data that is the same for every caller. Anything scoped to
 * a session must never go through here.
 */
type Entry = { value: unknown; expiresAt: number };

const store = new Map<string, Entry>();

/** Resolve `key` from cache, or run `load()` and remember it for `ttlMs`. */
export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const value = await load();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/** Drop cached entries after a write so the next read sees the new rows. */
export function invalidateCache(...keys: string[]) {
  keys.forEach((key) => store.delete(key));
}

export const CACHE_KEYS = {
  pricingPlans: "pricing-plans",
  coupons: "coupons",
  offers: "offers",
} as const;
