/**
 * JWT payload shape as stored in the token.
 * Standard claims: sub (user id), iat, exp.
 * App-specific: role, tenantId for authorization.
 */
export interface JwtPayload {
  sub: string;
  role: string;
  tenantId: string;
  iat?: number;
  exp?: number;
}

/**
 * Authenticated user attached to req.user by JwtStrategy.
 * Same shape as JwtPayload; used in handlers via @CurrentUser().
 */
export type AuthenticatedUser = JwtPayload;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express Request augmentation
  namespace Express {
    interface Request {
      /** Set by JwtStrategy after validating Bearer token. Used by @CurrentUser() */
      user?: AuthenticatedUser;
    }
  }
}
