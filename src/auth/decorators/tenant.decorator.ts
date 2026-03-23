import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Tenant as TenantEntity } from '../../common/tenant.types';

/**
 * Extracts the tenant from the request.
 * req.tenant is set by TenantMiddleware from the subdomain.
 * Use in route handlers: @Tenant() tenant: Tenant
 */
export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantEntity | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.tenant;
  },
);
