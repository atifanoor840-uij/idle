/**
 * High-impact economic calendar for the News Trading Rule.
 *
 * Source: Forex Factory's free weekly JSON feeds (no key). They are rate-limited,
 * so they are only ever read by the sync job (cron / admin "Sync now"), never
 * per request. Every high-impact event is stored in public.news_events forever —
 * payouts check trades from weeks ago — and a failed fetch never deletes
 * anything. Rule checks read the table via getRestrictedEvents().
 *
 * /api/news (ForexLive RSS headlines) is unrelated: it has no impact levels and
 * is not used for enforcement.
 */
import { supabase } from "./supabaseClient";
import { NEWS_RESTRICTED_IMPACT } from "./rulebook";
import { parseCalendarFeed, type CalendarFeedEvent, type NewsEvent } from "./newsRule";

export {
  normalizeSymbol,
  getSymbolCurrencies,
  detectNewsViolations,
  newsProfitToDeduct,
  parseCalendarFeed,
} from "./newsRule";
import { BRAND_SLUG } from "@/lib/brand";
export type { NewsEvent, NewsViolation, NewsTrade } from "./newsRule";

export const FOREX_FACTORY_FEEDS = [
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
];

// Feed etiquette: at most one real fetch per this interval per server instance,
// even if the sync route is hit repeatedly.
const MIN_FETCH_INTERVAL_MS = 5 * 60 * 1000;
let lastFetchAt = 0;

export type StoredNewsEvent = NewsEvent & {
  id: string;
  impact: string;
  isRestricted: boolean;
  source: string;
  createdAt?: string;
};

export type NewsSyncResult = {
  fetchedFeeds: number;
  highImpactEvents: number;
  stored: number;
  skipped?: string;
  errors: string[];
};

/**
 * Fetch both weekly feeds and insert new high-impact events. Existing rows are
 * left untouched (ignoreDuplicates), so an admin's isRestricted=false survives.
 */
export async function fetchHighImpactNews(options: { force?: boolean } = {}): Promise<NewsSyncResult> {
  const result: NewsSyncResult = { fetchedFeeds: 0, highImpactEvents: 0, stored: 0, errors: [] };
  const now = Date.now();
  if (!options.force && now - lastFetchAt < MIN_FETCH_INTERVAL_MS) {
    result.skipped = "Synced less than 5 minutes ago; feed is rate-limited.";
    return result;
  }
  lastFetchAt = now;

  const rows: CalendarFeedEvent[] = [];
  for (const url of FOREX_FACTORY_FEEDS) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "User-Agent": `${BRAND_SLUG}-news-calendar/1.0` },
        signal: AbortSignal.timeout(15_000),
      });
      // next week's feed is published late in the week; a 404 before that is normal.
      if (response.status === 404) continue;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      rows.push(...parseCalendarFeed(await response.json()));
      result.fetchedFeeds += 1;
    } catch (error: any) {
      const message = `${url}: ${error?.message || error}`;
      console.warn("News calendar fetch failed:", message);
      result.errors.push(message);
    }
  }

  // Same event can appear in both feeds around the week boundary.
  const unique = new Map(rows.map((row) => [`${row.eventTime}|${row.currency}|${row.title}`, row]));
  result.highImpactEvents = unique.size;
  if (unique.size === 0) return result;

  const { data, error } = await supabase
    .from("news_events")
    .upsert(Array.from(unique.values()), {
      onConflict: "eventTime,currency,title",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) {
    console.warn("News calendar upsert failed:", error);
    result.errors.push(error.message);
    return result;
  }
  result.stored = data?.length || 0;
  return result;
}

/**
 * Restricted events in [fromUtc, toUtc]. Returns null when the table can't be
 * read so callers can tell "no news" apart from "calendar unavailable" and keep
 * their stored violations instead of wiping them.
 */
export async function getRestrictedEvents(fromUtc: Date, toUtc: Date): Promise<StoredNewsEvent[] | null> {
  const { data, error } = await supabase
    .from("news_events")
    .select("*")
    .eq("isRestricted", true)
    .gte("eventTime", fromUtc.toISOString())
    .lte("eventTime", toUtc.toISOString())
    .order("eventTime", { ascending: true });
  if (error) {
    console.warn("News calendar read failed:", error.message);
    return null;
  }
  return (data || []).map(normalizeRow);
}

/** Every stored event in range, restricted or not (admin calendar). */
export async function listNewsEvents(fromUtc: Date, toUtc: Date): Promise<StoredNewsEvent[] | null> {
  const { data, error } = await supabase
    .from("news_events")
    .select("*")
    .gte("eventTime", fromUtc.toISOString())
    .lte("eventTime", toUtc.toISOString())
    .order("eventTime", { ascending: true });
  if (error) {
    console.warn("News calendar list failed:", error.message);
    return null;
  }
  return (data || []).map(normalizeRow);
}

export async function setNewsEventRestricted(id: string, isRestricted: boolean) {
  const { data, error } = await supabase
    .from("news_events")
    .update({ isRestricted })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeRow(data) : null;
}

function normalizeRow(row: any): StoredNewsEvent {
  return {
    id: String(row.id),
    eventTime: new Date(row.eventTime).toISOString(),
    currency: String(row.currency || "").toUpperCase(),
    title: String(row.title || ""),
    impact: String(row.impact || NEWS_RESTRICTED_IMPACT),
    isRestricted: row.isRestricted !== false,
    source: String(row.source || "forexfactory"),
    createdAt: row.createdAt,
  };
}
