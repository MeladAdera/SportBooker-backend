import * as Joi from 'joi';

export const envSchema = Joi.object({
  PORT: Joi.number().port().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  TENANT_HOST_SUFFIX: Joi.string().required().messages({
    'any.required':
      'TENANT_HOST_SUFFIX is required. Tenant resolution uses it to extract subdomain from Host.',
  }),
  /**
   * Full PostgreSQL connection string (e.g. Neon). When set, DB_HOST/DB_PORT/
   * DB_NAME/DB_USER/DB_PASSWORD are not required and are ignored.
   */
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .optional()
    .allow(''),
  DB_HOST: Joi.string().when('DATABASE_URL', {
    is: Joi.string().min(1),
    then: Joi.optional().allow(''),
    otherwise: Joi.required().messages({
      'any.required':
        'DB_HOST (or DATABASE_URL) is required for PostgreSQL connection.',
    }),
  }),
  DB_PORT: Joi.number()
    .port()
    .when('DATABASE_URL', {
      is: Joi.string().min(1),
      then: Joi.optional().allow(''),
      otherwise: Joi.required().messages({
        'any.required':
          'DB_PORT (or DATABASE_URL) is required for PostgreSQL connection.',
      }),
    }),
  DB_NAME: Joi.string().when('DATABASE_URL', {
    is: Joi.string().min(1),
    then: Joi.optional().allow(''),
    otherwise: Joi.required().messages({
      'any.required':
        'DB_NAME (or DATABASE_URL) is required for PostgreSQL connection.',
    }),
  }),
  DB_USER: Joi.string().when('DATABASE_URL', {
    is: Joi.string().min(1),
    then: Joi.optional().allow(''),
    otherwise: Joi.required().messages({
      'any.required':
        'DB_USER (or DATABASE_URL) is required for PostgreSQL connection.',
    }),
  }),
  DB_PASSWORD: Joi.string().when('DATABASE_URL', {
    is: Joi.string().min(1),
    then: Joi.optional().allow(''),
    otherwise: Joi.required().messages({
      'any.required':
        'DB_PASSWORD (or DATABASE_URL) is required for PostgreSQL connection.',
    }),
  }),
  DB_SSL: Joi.boolean().default(false),
  DB_POOL_MAX: Joi.number().integer().min(1).default(20),
  DB_POOL_IDLE_TIMEOUT_MILLIS: Joi.number().integer().min(0).default(10000),
  DB_POOL_CONNECTION_TIMEOUT_MILLIS: Joi.number()
    .integer()
    .min(0)
    .default(5000),
  DB_STATEMENT_TIMEOUT_MILLIS: Joi.number().integer().min(0).default(30000),
  JWT_ACCESS_SECRET: Joi.string().min(32).required().messages({
    'any.required': 'JWT_ACCESS_SECRET is required for JWT authentication.',
    'string.min': 'JWT_ACCESS_SECRET must be at least 32 characters.',
  }),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  /**
   * Public origin of this API (upload URLs, Ziina webhooks). No path.
   * Defaults to http://localhost:{PORT} when unset.
   */
  API_PUBLIC_ORIGIN: Joi.string().optional().allow(''),
  /**
   * Public origin of the browser app (Ziina success/cancel/failure redirects).
   * When unset, defaults to the resolved API public origin.
   */
  WEB_APP_PUBLIC_ORIGIN: Joi.string().optional().allow(''),
  /**
   * When false, tenant-scoped browser links (verify email, reset password,
   * payment redirects) use WEB_APP_PUBLIC_ORIGIN directly instead of
   * `{slug}.{TENANT_HOST_SUFFIX}`. Use for single-host deployments.
   */
  TENANT_SUBDOMAIN_URLS: Joi.boolean().default(true),
  /**
   * Demo only: wallet top-ups are credited immediately without Ziina.
   * Never enable for real money.
   */
  PAYMENTS_FREE_MODE: Joi.boolean().default(false),
  /** S3 bucket name for venue uploads. When set, uploads go to S3 instead of local disk. */
  S3_BUCKET_NAME: Joi.string().optional().allow(''),
  S3_REGION: Joi.string().optional().allow(''),
  /** Vercel Blob token. When set (and S3 is not), uploads go to Vercel Blob. */
  BLOB_READ_WRITE_TOKEN: Joi.string().optional().allow(''),
  /**
   * AES-256-GCM key for encrypting Ziina access tokens at rest.
   * Must be exactly 64 hex characters (32 bytes).
   * Generate with: openssl rand -hex 32
   */
  ZIINA_ENCRYPTION_KEY: Joi.string().length(64).optional().allow(''),
  RESEND_API_KEY: Joi.string().optional().allow(''),
  EMAIL_FROM: Joi.string().optional().allow(''),
  EMAIL_APP_NAME: Joi.string().optional().allow(''),
  EMAIL_SUPPORT_EMAIL: Joi.string().optional().allow(''),
  EMAIL_WAITLIST_REFUND_ETA: Joi.string().optional().allow(''),
  RESEND_TEMPLATE_PASSWORD_RESET_ID: Joi.string().optional().allow(''),
  RESEND_TEMPLATE_EMAIL_VERIFICATION_ID: Joi.string().optional().allow(''),
  RESEND_TEMPLATE_WAITLIST_EXPIRED_REFUND_ID: Joi.string().optional().allow(''),
  /**
   * When set (min 32 chars), enables OpenAPI in production and requires
   * `Authorization: Bearer <token>` for `/api/docs` and `/api/docs-json`.
   * Use the same value in frontend CI (Orval) and store in GitHub Actions secrets.
   */
  OPENAPI_DOCS_TOKEN: Joi.alternatives()
    .try(Joi.string().valid(''), Joi.string().min(32))
    .optional(),
  /** Comma-separated browser origins allowed for CORS (e.g. Vercel + local dev). Empty = CORS off. */
  CORS_ORIGINS: Joi.string().optional().allow(''),
});
