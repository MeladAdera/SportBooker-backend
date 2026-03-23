import { SetMetadata } from '@nestjs/common';

/** Metadata key for required roles. RolesGuard reads this. */
export const ROLES_KEY = 'roles';

/**
 * Restricts route to users with one of the given roles.
 * Must be used with @UseGuards(RolesGuard) on the route.
 * Example: @Roles('super_admin', 'tenant_admin')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
