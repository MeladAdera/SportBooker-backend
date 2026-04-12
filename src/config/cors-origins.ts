/**
 * Parses `CORS_ORIGINS` env: comma-separated URLs. Trailing slashes removed.
 * Empty / unset → empty array.
 */
export function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/**
 * Builds a CORS origin callback that allows:
 *  1. All explicitly listed origins from CORS_ORIGINS
 *  2. Any https://*.{appDomain} subdomain (for tenant subdomains)
 *
 * Returns `false` (no CORS) when both lists are empty.
 */
export function buildCorsOrigin(
  staticOrigins: string[],
  appDomain: string,
):
  | false
  | ((
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => void) {
  if (staticOrigins.length === 0 && !appDomain) return false;

  const staticSet = new Set(staticOrigins);
  const subdomainSuffix = `.${appDomain.toLowerCase()}`;

  return (
    origin: string | undefined,
    cb: (err: Error | null, allow?: boolean) => void,
  ) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin) return cb(null, true);

    if (staticSet.has(origin)) return cb(null, true);

    // Match https://{anything}.sportbooker.net
    try {
      const url = new URL(origin);
      if (url.protocol === 'https:' && url.hostname.endsWith(subdomainSuffix)) {
        return cb(null, true);
      }
    } catch {
      // malformed origin — reject
    }

    cb(null, false);
  };
}
