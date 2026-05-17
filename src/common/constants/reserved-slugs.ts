/**
 * Subdomains/paths reserved for platform infrastructure.
 * Must not be used as tenant slugs (validated on create).
 */
export const RESERVED_SLUGS = [
  'api',
  'admin',
  'www',
  'mail',
  'static',
  'app',
  'dashboard',
  'health',
  'platform',
] as const;
