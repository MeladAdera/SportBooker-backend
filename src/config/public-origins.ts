import { ConfigService } from '@nestjs/config';
import { buildTenantPublicOrigin } from '../payments/tenant-public-url';

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

/**
 * Browser origin for tenant-scoped links (email verification, password reset,
 * payment redirects).
 *
 * - Default: `{protocol}//{slug}.{TENANT_HOST_SUFFIX}` (one subdomain per tenant).
 * - `TENANT_SUBDOMAIN_URLS=false`: the web app has no tenant subdomains (e.g. a
 *   single-host demo on *.vercel.app, or plain localhost dev), so links use
 *   `WEB_APP_PUBLIC_ORIGIN` as-is.
 */
export function resolveTenantWebOrigin(
  config: ConfigService,
  tenantSlug: string,
): string {
  const webOrigin = resolveWebAppPublicOrigin(config);
  const useSubdomains = config.get<boolean>('TENANT_SUBDOMAIN_URLS', true);
  if (useSubdomains === false || String(useSubdomains) === 'false') {
    return webOrigin;
  }
  return buildTenantPublicOrigin(
    webOrigin,
    config.getOrThrow<string>('TENANT_HOST_SUFFIX'),
    tenantSlug,
  );
}
