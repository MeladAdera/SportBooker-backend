import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Tenant } from '../../common/tenant.types';

const TENANT_REQUIRED_MESSAGE =
  'Tenant is required. Use Host header with tenant subdomain (e.g. acfc.localhost:3000).';

/**
 * Ensures `req.tenant` is set by TenantMiddleware.
 * Use on tenant-scoped controllers (routes not excluded from tenant middleware).
 */
@Injectable()
export class TenantRequiredGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { tenant?: Tenant }>();
    if (!req.tenant) {
      throw new BadRequestException(TENANT_REQUIRED_MESSAGE);
    }
    return true;
  }
}
