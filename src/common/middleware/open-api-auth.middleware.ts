import type { NextFunction, Request, Response } from 'express';

/** Paths registered by `SwaggerModule.setup('api/docs', …)`. */
export function isOpenApiRoute(path: string): boolean {
  return (
    path === '/api/docs-json' ||
    path === '/api/docs' ||
    path.startsWith('/api/docs/')
  );
}

/**
 * When `token` is set, require `Authorization: Bearer <token>` for OpenAPI UI and JSON.
 * When `token` is unset, allow all (local dev).
 */
export function openApiAuthMiddleware(
  token: string | undefined,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isOpenApiRoute(req.path)) {
      next();
      return;
    }
    if (!token) {
      next();
      return;
    }
    if (req.headers.authorization === `Bearer ${token}`) {
      next();
      return;
    }
    res.setHeader('WWW-Authenticate', 'Bearer realm="OpenAPI"');
    res.status(401).json({
      statusCode: 401,
      message: 'OpenAPI documentation requires a valid bearer token.',
    });
  };
}
