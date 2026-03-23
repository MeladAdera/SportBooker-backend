import { SetMetadata } from '@nestjs/common';

/** Metadata key for public routes. JwtAuthGuard checks this to skip auth. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as public — no JWT required.
 * Use on health checks, login, register, etc.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
