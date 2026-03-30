import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

type RequestWithTenantUser = Request & {
  tenant?: { id: string };
  user?: AuthenticatedUser;
};

/**
 * Ensures JWT `tenantId` matches the tenant resolved from the request Host (subdomain).
 * Prevents using an ACFC token against downtown.localhost (and vice versa).
 *
 * Skips when:
 * - Route is @Public() (no user yet, e.g. login/register)
 * - No `req.tenant` (routes excluded from TenantMiddleware, e.g. admin/tenants)
 */
@Injectable()
export class TenantUserMatchGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithTenantUser>();

    if (!req.tenant) {
      return true;
    }

    const user = req.user;
    if (!user?.tenantId) {
      return true;
    }

    if (user.tenantId !== req.tenant.id) {
      throw new ForbiddenException(
        'This token belongs to a different tenant than the request host. Log in on this subdomain or use the correct Host header.',
      );
    }

    return true;
  }
}
