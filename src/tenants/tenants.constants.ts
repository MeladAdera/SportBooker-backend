/**
 * Subdomains/paths reserved for platform infrastructure.
 * Must not be used as tenant slugs.
 */
export const RESERVED_SLUGS = [
  'api',
  'admin',
  'www',
  'mail',
  'static',
  'app',
] as const;

export const DEFAULT_TENANT_TIMEZONE = 'Asia/Dubai';
export const DEFAULT_CANCEL_CUTOFF_HOURS = 24;
