/** DB `user_role` enum values used in authorization and assignment. */
export enum UserRole {
  PlatformAdmin = 'platform_admin',
  SuperAdmin = 'super_admin',
  TenantAdmin = 'tenant_admin',
  TenantStaff = 'tenant_staff',
  Player = 'player',
}

/** Roles that may appear in PATCH /users/:id/role body (per product spec). */
export const ASSIGNABLE_ROLE_VALUES = [
  UserRole.TenantAdmin,
  UserRole.TenantStaff,
  UserRole.Player,
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLE_VALUES)[number];

/** Numeric rank for comparing roles (higher = more privilege). */
export function roleRank(role: string): number {
  switch (role) {
    case 'platform_admin':
      return 5;
    case 'super_admin':
      return 4;
    case 'tenant_admin':
      return 3;
    case 'tenant_staff':
      return 2;
    case 'player':
      return 1;
    default:
      return 0;
  }
}
