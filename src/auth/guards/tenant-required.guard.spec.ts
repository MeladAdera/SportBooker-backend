import { BadRequestException } from '@nestjs/common';
import { TenantRequiredGuard } from './tenant-required.guard';

describe('TenantRequiredGuard', () => {
  const createContext = (req: { tenant?: { id: string } }) => ({
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  });

  it('returns true when req.tenant is set', () => {
    const guard = new TenantRequiredGuard();
    const result = guard.canActivate(
      createContext({
        tenant: { id: '550e8400-e29b-41d4-a716-446655440000' },
      }) as never,
    );
    expect(result).toBe(true);
  });

  it('throws BadRequestException when req.tenant is missing', () => {
    const guard = new TenantRequiredGuard();
    expect(() => guard.canActivate(createContext({}) as never)).toThrow(
      BadRequestException,
    );
    expect(() => guard.canActivate(createContext({}) as never)).toThrow(
      'Tenant is required. Use Host header with tenant subdomain (e.g. acfc.localhost:3000).',
    );
  });
});
