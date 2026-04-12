import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';
import { invalidateTenantCache, TenantMiddleware } from './tenant.middleware';
import { DB_POOL } from '../database/database.constants';
import type { Tenant } from '../common/tenant.types';

/** Minimal mock request with get() and tenant for middleware tests */
function mockReq(
  host?: string,
  xForwardedHost?: string,
  xTenantSlug?: string,
): Request & { tenant?: Tenant } {
  const req = {
    get: jest.fn((name: string): string | undefined => {
      if (name === 'Host') return host ?? '';
      if (name === 'X-Forwarded-Host') return xForwardedHost;
      if (name === 'X-Tenant-Slug') return xTenantSlug;
      return undefined;
    }),
    tenant: undefined as Tenant | undefined,
  };
  return req as unknown as Request & { tenant?: Tenant };
}

function mockRes(): Response {
  return {} as Response;
}

function mockNext(): NextFunction {
  return jest.fn() as unknown as NextFunction;
}

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;
  let nextFn: NextFunction;

  const mockPool = {
    query: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn().mockReturnValue('localhost:3000'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    invalidateTenantCache('acfc');
    mockConfigService.getOrThrow.mockReturnValue('localhost:3000');
    nextFn = mockNext();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantMiddleware,
        { provide: DB_POOL, useValue: mockPool },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    middleware = module.get<TenantMiddleware>(TenantMiddleware);
  });

  it('returns 400 when no subdomain present', async () => {
    const req = mockReq('localhost:3000');

    await expect(middleware.use(req, mockRes(), nextFn)).rejects.toThrow(
      BadRequestException,
    );

    expect(nextFn).not.toHaveBeenCalled();
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('returns 404 when tenant slug not found', async () => {
    const req = mockReq('acfc.localhost:3000');
    mockPool.query.mockResolvedValue({ rows: [] });

    await expect(middleware.use(req, mockRes(), nextFn)).rejects.toThrow(
      NotFoundException,
    );

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE slug = $1'),
      ['acfc'],
    );
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('returns 403 when tenant is inactive', async () => {
    const req = mockReq('acfc.localhost:3000');
    mockPool.query.mockResolvedValue({
      rows: [
        {
          id: 'uuid-1',
          name: 'AC FC',
          slug: 'acfc',
          cancel_cutoff_hours: 24,
          is_active: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });

    await expect(middleware.use(req, mockRes(), nextFn)).rejects.toThrow(
      ForbiddenException,
    );

    expect(nextFn).not.toHaveBeenCalled();
  });

  it('attaches tenant to req and calls next when found and active', async () => {
    const req = mockReq('acfc.localhost:3000');
    const tenantRow = {
      id: 'uuid-1',
      name: 'AC FC',
      slug: 'acfc',
      cancel_cutoff_hours: 24,
      is_active: true,
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-02'),
    };
    mockPool.query.mockResolvedValue({ rows: [tenantRow] });

    await middleware.use(req, mockRes(), nextFn);

    expect(req.tenant).toEqual(tenantRow);
    expect(nextFn).toHaveBeenCalled();
  });

  it('prefers X-Forwarded-Host over Host', async () => {
    mockConfigService.getOrThrow.mockReturnValue('sportbooker.com');
    const req = mockReq('localhost:3000', 'acfc.sportbooker.com');
    mockPool.query.mockResolvedValue({
      rows: [
        {
          id: 'uuid-1',
          name: 'AC FC',
          slug: 'acfc',
          cancel_cutoff_hours: 24,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });

    await middleware.use(req, mockRes(), nextFn);

    expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ['acfc']);
    expect(req.tenant?.slug).toBe('acfc');
  });

  it('resolves tenant from X-Tenant-Slug header (no subdomain needed)', async () => {
    const req = mockReq('api.sportbooker.net', undefined, 'acfc');
    mockConfigService.getOrThrow.mockReturnValue('sportbooker.net');
    mockPool.query.mockResolvedValue({
      rows: [
        {
          id: 'uuid-1',
          name: 'AC FC',
          slug: 'acfc',
          cancel_cutoff_hours: 24,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });

    await middleware.use(req, mockRes(), nextFn);

    expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ['acfc']);
    expect(req.tenant?.slug).toBe('acfc');
  });

  it('X-Tenant-Slug takes precedence over Host subdomain', async () => {
    const req = mockReq('other.localhost:3000', undefined, 'acfc');
    mockPool.query.mockResolvedValue({
      rows: [
        {
          id: 'uuid-1',
          name: 'AC FC',
          slug: 'acfc',
          cancel_cutoff_hours: 24,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });

    await middleware.use(req, mockRes(), nextFn);

    expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ['acfc']);
    expect(req.tenant?.slug).toBe('acfc');
  });

  it('falls back to Host extraction when X-Tenant-Slug is not set', async () => {
    const req = mockReq('acfc.localhost:3000');
    mockPool.query.mockResolvedValue({
      rows: [
        {
          id: 'uuid-1',
          name: 'AC FC',
          slug: 'acfc',
          cancel_cutoff_hours: 24,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });

    await middleware.use(req, mockRes(), nextFn);

    expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ['acfc']);
    expect(req.tenant?.slug).toBe('acfc');
  });

  it('normalizes X-Tenant-Slug to lowercase and trims whitespace', async () => {
    const req = mockReq('api.sportbooker.net', undefined, '  ACFC  ');
    mockConfigService.getOrThrow.mockReturnValue('sportbooker.net');
    mockPool.query.mockResolvedValue({
      rows: [
        {
          id: 'uuid-1',
          name: 'AC FC',
          slug: 'acfc',
          cancel_cutoff_hours: 24,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });

    await middleware.use(req, mockRes(), nextFn);

    expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ['acfc']);
  });
});
