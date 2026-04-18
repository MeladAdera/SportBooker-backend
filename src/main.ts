import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import { createValidationExceptionFactory } from './common/pipes/validation-exception.factory';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { openApiAuthMiddleware } from './common/middleware/open-api-auth.middleware';
import { parseCorsOrigins, buildCorsOrigin } from './config/cors-origins';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // Trust X-Forwarded-For when behind a reverse proxy (nginx, etc.)
  const httpAdapter = app.getHttpAdapter();
  const expressApp = httpAdapter.getInstance?.() as {
    set?: (key: string, val: unknown) => void;
  };
  if (expressApp?.set) expressApp.set('trust proxy', 1);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: createValidationExceptionFactory(),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  app.enableShutdownHooks();

  const config = app.get(ConfigService);

  const staticOrigins = parseCorsOrigins(config.get<string>('CORS_ORIGINS'));
  const appDomain = config.getOrThrow<string>('TENANT_HOST_SUFFIX');
  const corsOrigin = buildCorsOrigin(staticOrigins, appDomain);
  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'Accept',
        'X-Requested-With',
        'X-Forwarded-Host',
        'X-Tenant-Slug',
      ],
    });
  }

  const openApiToken = (config.get<string>('OPENAPI_DOCS_TOKEN') ?? '').trim();
  const nodeEnv = config.getOrThrow<string>('NODE_ENV');
  const enableOpenApi = nodeEnv !== 'production' || openApiToken.length > 0;

  if (enableOpenApi) {
    app.use(openApiAuthMiddleware(openApiToken || undefined));
    const document = new DocumentBuilder()
      .setTitle('Sportbooker API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, document),
    );
  }

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
}
bootstrap().catch((err) => {
  console.error('Application failed to start:', err);
  process.exit(1);
});
