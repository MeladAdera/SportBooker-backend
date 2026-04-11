import type { NextFunction, Request, Response } from 'express';
import {
  isOpenApiRoute,
  openApiAuthMiddleware,
} from './open-api-auth.middleware';

describe('isOpenApiRoute', () => {
  it('matches swagger ui, json, and static assets under /api/docs/', () => {
    expect(isOpenApiRoute('/api/docs')).toBe(true);
    expect(isOpenApiRoute('/api/docs-json')).toBe(true);
    expect(isOpenApiRoute('/api/docs/swagger-ui.css')).toBe(true);
    expect(isOpenApiRoute('/health')).toBe(false);
  });
});

describe('openApiAuthMiddleware', () => {
  const mockRes = (): {
    res: Response;
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
  } => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn().mockReturnThis();
    const setHeader = jest.fn().mockReturnThis();
    const res = { status, json, setHeader } as unknown as Response;
    return { res, status, json, setHeader };
  };

  const next: NextFunction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes through non-openapi paths', () => {
    const mw = openApiAuthMiddleware('secret');
    mw({ path: '/v1/foo' } as Request, mockRes().res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows openapi routes when no token configured', () => {
    const mw = openApiAuthMiddleware(undefined);
    mw({ path: '/api/docs-json', headers: {} } as Request, mockRes().res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when token is set and Authorization is missing', () => {
    const { res, status } = mockRes();
    const mw = openApiAuthMiddleware('secret');
    mw({ path: '/api/docs-json', headers: {} } as Request, res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows openapi when Bearer token matches', () => {
    const mw = openApiAuthMiddleware('secret');
    mw(
      {
        path: '/api/docs-json',
        headers: { authorization: 'Bearer secret' },
      } as Request,
      mockRes().res,
      next,
    );
    expect(next).toHaveBeenCalled();
  });
});
