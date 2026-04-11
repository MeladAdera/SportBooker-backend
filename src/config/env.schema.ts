import * as Joi from 'joi';

export const envSchema = Joi.object({
  PORT: Joi.number().port().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  APP_DOMAIN: Joi.string().required().messages({
    'any.required':
      'APP_DOMAIN is required. Tenant resolution uses it to extract subdomain from Host.',
  }),
  DB_HOST: Joi.string().required().messages({
    'any.required': 'DB_HOST is required for PostgreSQL connection.',
  }),
  DB_PORT: Joi.number().port().required().messages({
    'any.required': 'DB_PORT is required for PostgreSQL connection.',
  }),
  DB_NAME: Joi.string().required().messages({
    'any.required': 'DB_NAME is required for PostgreSQL connection.',
  }),
  DB_USER: Joi.string().required().messages({
    'any.required': 'DB_USER is required for PostgreSQL connection.',
  }),
  DB_PASSWORD: Joi.string().required().messages({
    'any.required': 'DB_PASSWORD is required for PostgreSQL connection.',
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
  /** Base URL for absolute links to locally stored uploads (e.g. https://api.example.com). Defaults to http://localhost:{PORT}. */
  PUBLIC_BASE_URL: Joi.string().optional().allow(''),
  /** S3 bucket name for venue uploads. When set, uploads go to S3 instead of local disk. */
  S3_BUCKET_NAME: Joi.string().optional().allow(''),
  S3_REGION: Joi.string().optional().allow(''),
  STRIPE_SECRET_KEY: Joi.string().optional().allow(''),
  STRIPE_WEBHOOK_SECRET: Joi.string().optional().allow(''),
  SENDGRID_API_KEY: Joi.string().optional().allow(''),
  EMAIL_FROM: Joi.string().email().optional().allow(''),
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
