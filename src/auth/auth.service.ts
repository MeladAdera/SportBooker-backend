import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { UsersRepository } from '../users/users.repository';
import { AuthRepository } from './auth.repository';
import { EmailService } from './email.service';
import type { LoginDto } from './dto/login.dto';
import type { LoginResponseDto } from './dto/login-response.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { RefreshResponseDto } from './dto/refresh-response.dto';
import type { RegisterDto } from './dto/register.dto';
import type { RegisterResponseDto } from './dto/register-response.dto';

const BCRYPT_ROUNDS = 12;

/** Used when user not found — bcrypt.compare consumes ~same time to prevent enumeration */
const DUMMY_HASH = bcrypt.hashSync('__auth_enumeration_dummy__', BCRYPT_ROUNDS);

function parseExpiresInToSeconds(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 900;
  const n = parseInt(match[1], 10);
  switch (match[2]) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86400;
    default:
      return 900;
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(
    dto: RegisterDto,
    tenantId: string,
  ): Promise<RegisterResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const row = await this.usersRepository.insertRegisteredUser({
        tenantId,
        name: dto.name,
        email: dto.email,
        passwordHash,
        phone: dto.phone ?? null,
      });

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        createdAt: row.created_at,
      };
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === '23505') {
        throw new ConflictException('Email already registered for this tenant');
      }
      throw err;
    }
  }

  async login(dto: LoginDto, tenantId: string): Promise<LoginResponseDto> {
    const user = await this.usersRepository.findForLogin(tenantId, dto.email);
    const hashToCompare = user?.password_hash ?? DUMMY_HASH;

    const valid = await bcrypt.compare(dto.password, hashToCompare);

    if (
      !valid ||
      !user ||
      user.deleted_at != null ||
      user.is_active === false
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const expiresInStr = this.config.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '15m',
    );
    const expiresIn = parseExpiresInToSeconds(expiresInStr);

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        role: user.role,
        tenantId,
      },
      { expiresIn: expiresInStr },
    );

    const refreshSecret = randomBytes(32).toString('hex');
    const refreshHash = await bcrypt.hash(refreshSecret, BCRYPT_ROUNDS);

    const refreshId = await this.authRepository.createRefreshToken(
      user.id,
      refreshHash,
    );

    const refreshToken = `${refreshId}.${refreshSecret}`;

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  async refresh(refreshToken: string): Promise<RefreshResponseDto> {
    const parts = refreshToken.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const [id, secret] = parts;

    return this.authRepository.runInTransaction(async (client) => {
      const row = await this.authRepository.findRefreshTokenWithUserForUpdate(
        client,
        id,
      );

      if (!row) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const hashValid = await bcrypt.compare(secret, row.token_hash);
      if (!hashValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      await this.authRepository.deleteRefreshTokenById(client, id);

      const expiresInStr = this.config.get<string>(
        'JWT_ACCESS_EXPIRES_IN',
        '15m',
      );
      const expiresIn = parseExpiresInToSeconds(expiresInStr);

      const accessToken = this.jwtService.sign(
        {
          sub: row.user_id,
          role: row.role,
          tenantId: row.tenant_id,
        },
        { expiresIn: expiresInStr },
      );

      const refreshSecret = randomBytes(32).toString('hex');
      const refreshHash = await bcrypt.hash(refreshSecret, BCRYPT_ROUNDS);

      const newRefreshId = await this.authRepository.insertRefreshToken(
        client,
        row.user_id,
        refreshHash,
      );

      const newRefreshToken = `${newRefreshId}.${refreshSecret}`;

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn,
      };
    });
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.authRepository.deleteAllRefreshTokensForUser(userId);
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
    tenantId: string,
    tenantSlug: string,
  ): Promise<void> {
    const user = await this.usersRepository.findActiveByEmailForTenant(
      tenantId,
      dto.email,
    );

    if (!user) {
      return;
    }

    await this.authRepository.deletePasswordResetTokensForUser(user.id);

    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(plainToken, BCRYPT_ROUNDS);

    const resetId = await this.authRepository.createPasswordResetToken(
      user.id,
      tokenHash,
    );

    const fullToken = `${resetId}.${plainToken}`;

    const appDomain = this.config.getOrThrow<string>('APP_DOMAIN');
    const protocol = appDomain.includes('localhost') ? 'http' : 'https';
    const resetLink = `${protocol}://${tenantSlug}.${appDomain}/reset-password?token=${encodeURIComponent(fullToken)}`;

    await this.emailService.sendPasswordResetEmail(user.email, resetLink);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const parts = dto.token.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const [id, secret] = parts;

    return this.authRepository.runInTransaction(async (client) => {
      const row = await this.authRepository.findPasswordResetTokenForUpdate(
        client,
        id,
      );

      if (!row) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      const hashValid = await bcrypt.compare(secret, row.token_hash);
      if (!hashValid) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

      await this.usersRepository.updatePasswordHash(
        client,
        row.user_id,
        passwordHash,
      );

      await this.authRepository.markPasswordResetTokenUsed(client, id);

      await this.authRepository.deleteRefreshTokensByUserId(
        client,
        row.user_id,
      );

      return { message: 'Password reset successfully' };
    });
  }
}
