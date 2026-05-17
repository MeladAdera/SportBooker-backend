import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth.types';

/**
 * Role-based access guard. Apply with @UseGuards(RolesGuard) on routes that need it.
 * - Reads @Roles('a', 'b') metadata
 * - If no roles metadata → allow (route doesn't require role check)
 * - If req.user.role is in required roles → allow
 * - Else → 403 Forbidden
 *
 * Must be used after JwtAuthGuard (which sets req.user).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `Insufficient role. Required one of: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
