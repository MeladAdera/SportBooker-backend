import { ConfigService } from '@nestjs/config';

function stripOrigin(value: string): string {
  return value.trim().replace(/\/$/, '');
}

/**
 * Public origin of this Nest API (disk upload URLs, Ziina webhooks).
 * No trailing slash. Defaults to http://localhost:{PORT} when unset.
 */
export function resolveApiPublicOrigin(config: ConfigService): string {
  const direct = config.get<string>('API_PUBLIC_ORIGIN');
  if (direct?.trim()) return stripOrigin(direct);
  const port = config.get<number>('PORT') ?? 3000;
  return `http://localhost:${port}`;
}

/**
 * Public origin of the browser app (Ziina success/cancel/failure redirects).
 * Only the **protocol** (http vs https) is taken from this URL; the redirect **host**
 * is always `{slug}.{TENANT_HOST_SUFFIX}` so it matches tenant resolution.
 * Falls back to the API origin when unset (single-host dev).
 */
export function resolveWebAppPublicOrigin(config: ConfigService): string {
  const direct = config.get<string>('WEB_APP_PUBLIC_ORIGIN');
  if (direct?.trim()) return stripOrigin(direct);
  return resolveApiPublicOrigin(config);
}
