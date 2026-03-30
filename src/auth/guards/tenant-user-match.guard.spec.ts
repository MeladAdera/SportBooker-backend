import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantUserMatchGuard } from './tenant-user-match.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('TenantUserMatchGuard', () => {
  const tenantId = '550e8400-e29b-41d4-a716-446655440000';
  const otherTenantId = '660e8400-e29b-41d4-a716-446655440001';

  const createContext = (req: {
    tenant?: { id: string };
    user?: { tenantId: string };
  }) => ({
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  });

  it('allows public routes without checking tenant', () => {
    const getAllAndOverride = jest.fn().mockReturnValue(true);
    const reflector = { getAllAndOverride } as unknown as Reflector;
    const guard = new TenantUserMatchGuard(reflector);

    const result = guard.canActivate(
      createContext({
        tenant: { id: tenantId },
        user: { tenantId: otherTenantId },
      }) as never,
    );

    expect(result).toBe(true);
    expect(getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });

  it('allows when no tenant on request (e.g. admin routes)', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new TenantUserMatchGuard(reflector);

    const result = guard.canActivate(
      createContext({
        user: { tenantId: tenantId },
      }) as never,
    );

    expect(result).toBe(true);
  });

  it('allows when tenant matches user tenantId', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new TenantUserMatchGuard(reflector);

    const result = guard.canActivate(
      createContext({
        tenant: { id: tenantId },
        user: { tenantId: tenantId },
      }) as never,
    );

    expect(result).toBe(true);
  });

  it('throws ForbiddenException when tenant does not match user tenantId', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new TenantUserMatchGuard(reflector);

    expect(() =>
      guard.canActivate(
        createContext({
          tenant: { id: tenantId },
          user: { tenantId: otherTenantId },
        }) as never,
      ),
    ).toThrow(ForbiddenException);
  });
});
