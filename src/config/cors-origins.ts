/**
 * Parses `CORS_ORIGINS` env: comma-separated URLs. Trailing slashes removed.
 * Empty / unset → no CORS (same as before `enableCors`).
 */
export function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}
