/**
 * Origin for tenant-scoped browser URLs (e.g. Ziina success/cancel redirects).
 * Uses protocol from the web app public origin and host `{slug}.{TENANT_HOST_SUFFIX}`.
 */
export function buildTenantPublicOrigin(
  publicBaseUrl: string,
  appDomain: string,
  tenantSlug: string,
): string {
  const base = publicBaseUrl.replace(/\/$/, '');
  let protocol = 'http:';
  try {
    protocol = new URL(base).protocol;
  } catch {
    // invalid origin string — fall back to http:
  }
  const domain = appDomain.replace(/\/$/, '').toLowerCase();
  const slug = tenantSlug.toLowerCase();
  return `${protocol}//${slug}.${domain}`;
}
