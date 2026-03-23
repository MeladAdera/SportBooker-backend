import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '../auth.types';

/**
 * Passport JWT strategy.
 * - Extracts token from Authorization: Bearer <token>
 * - Verifies signature with JWT_ACCESS_SECRET
 * - validate() return value is attached to req.user
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_ACCESS_SECRET must be set and at least 32 characters when using auth.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Called after token is verified. Return value becomes req.user.
   * Payload shape: { sub, role, tenantId, iat, exp }
   */
  validate(payload: JwtPayload) {
    if (!payload.sub || !payload.role || !payload.tenantId) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      sub: payload.sub,
      role: payload.role,
      tenantId: payload.tenantId,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
