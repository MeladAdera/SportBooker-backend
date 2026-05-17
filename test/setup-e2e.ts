// Ensure required env vars exist for e2e tests (ConfigModule + DatabaseModule validation)
process.env.PORT = process.env.PORT ?? '3000';
process.env.TENANT_HOST_SUFFIX =
  process.env.TENANT_HOST_SUFFIX ?? 'localhost:3000';
process.env.DB_HOST = process.env.DB_HOST ?? 'localhost';
process.env.DB_PORT = process.env.DB_PORT ?? '5432';
process.env.DB_NAME = process.env.DB_NAME ?? 'sportbooker_test';
process.env.DB_USER = process.env.DB_USER ?? 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'postgres';
