// Visitor country detection.
//
// Order of preference:
//   1. Hosting-edge headers (free, instant, no external call). Vercel,
//      Cloudflare and Netlify all inject the resolved ISO country code.
//   2. A free IP-geolocation lookup (ipwho.is, then ip-api.com) using the
//      real client IP pulled from the forwarding headers. Used only when the
//      edge header is missing -- local dev, or a proxy in front of the host
//      that strips the geo header (this is why the earlier Vercel-only
//      approach saw a null country in production).
//
// Results are cached in-process per IP so repeated requests within a session
// don't spend the free-tier budget. Detection fails open: when the country
// cannot be determined, `isPakistan` is false and region-gated options stay
// visible.

const COUNTRY_CACHE = new Map<string, { country: string | null; expires: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const LOOKUP_TIMEOUT_MS = 2500;

export type GeoResult = {
  country: string | null;
  isPakistan: boolean;
  source: "edge-header" | "ip-lookup" | "unknown";
};

export function getClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("x-vercel-forwarded-for") ||
    null
  );
}

function countryFromEdgeHeaders(headers: Headers): string | null {
  const direct =
    headers.get("x-vercel-ip-country") ||
    headers.get("cf-ipcountry") ||
    headers.get("x-country-code");
  if (direct && direct.toUpperCase() !== "XX") return direct.toUpperCase();

  // Netlify ships a JSON blob rather than a bare code.
  const netlify = headers.get("x-nf-geo");
  if (netlify) {
    try {
      const parsed = JSON.parse(netlify);
      if (parsed?.country?.code) return String(parsed.country.code).toUpperCase();
    } catch {
      // ignore a malformed header
    }
  }
  return null;
}

function isPrivateIp(ip: string): boolean {
  const value = ip.toLowerCase();
  if (value === "127.0.0.1" || value === "::1" || value.startsWith("::ffff:127.")) {
    return true;
  }
  if (
    /^10\./.test(value) ||
    /^192\.168\./.test(value) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(value)
  ) {
    return true;
  }
  // Unique-local / link-local IPv6.
  return /^(fc|fd|fe80)/.test(value);
}

async function fetchCountry(
  url: string,
  pick: (data: unknown) => string | null,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const code = pick(await res.json());
    return code ? code.toUpperCase() : null;
  } catch {
    return null;
  }
}

async function lookupCountryByIp(ip: string): Promise<string | null> {
  const cached = COUNTRY_CACHE.get(ip);
  if (cached && cached.expires > Date.now()) return cached.country;

  let country = await fetchCountry(
    `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code`,
    (data) => {
      const d = data as { success?: boolean; country_code?: string };
      return d?.success ? d.country_code || null : null;
    },
  );

  if (!country) {
    country = await fetchCountry(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`,
      (data) => {
        const d = data as { status?: string; countryCode?: string };
        return d?.status === "success" ? d.countryCode || null : null;
      },
    );
  }

  COUNTRY_CACHE.set(ip, { country, expires: Date.now() + CACHE_TTL_MS });
  return country;
}

export async function detectCountry(request: Request): Promise<GeoResult> {
  const edge = countryFromEdgeHeaders(request.headers);
  if (edge) {
    return { country: edge, isPakistan: edge === "PK", source: "edge-header" };
  }

  const ip = getClientIp(request.headers);
  if (ip && !isPrivateIp(ip)) {
    const country = await lookupCountryByIp(ip);
    if (country) {
      return { country, isPakistan: country === "PK", source: "ip-lookup" };
    }
  }

  return { country: null, isPakistan: false, source: "unknown" };
}
