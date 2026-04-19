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
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { RegisterDto } from './dto/register.dto';
import type { RegisterResponseDto } from './dto/register-response.dto';
import type { VerifyEmailDto } from './dto/verify-email.dto';
import type { ResendVerificationEmailDto } from './dto/resend-verification-email.dto';
import { parseE164ToBigint, E164_STRING_REGEX } from './register-phone.util';

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
    tenantSlug: string,
  ): Promise<RegisterResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const phone = parseE164ToBigint(dto.phone);

      const row = await this.usersRepository.insertRegisteredUser({
        tenantId,
        name: dto.name,
        email: dto.email,
        passwordHash,
        phone,
        dateOfBirth: dto.dateOfBirth,
        nationality: dto.nationality,
        preferredLanguage: dto.preferredLanguage,
        skillLevel: dto.skillLevel,
        preferredPosition: dto.preferredPosition,
        dominantFoot: dto.dominantFoot,
        photoUrl: dto.photoUrl,
        preferredDays: dto.preferredDays,
      });
      await this.sendEmailVerificationLink(
        row.id,
        row.email,
        row.name,
        tenantSlug,
      );
      return {
        message:
          'Registration successful. Please verify your email to continue.',
        emailVerificationRequired: true,
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
    const isPhone = E164_STRING_REGEX.test(dto.identifier);
    const user = isPhone
      ? await this.usersRepository.findForLoginByPhone(
          tenantId,
          parseE164ToBigint(dto.identifier),
        )
      : await this.usersRepository.findForLogin(tenantId, dto.identifier);
    const hashToCompare = user?.password_hash ?? DUMMY_HASH;

    const valid = await bcrypt.compare(dto.password, hashToCompare);

    if (
      !valid ||
      !user ||
      user.deleted_at != null ||
      user.is_active === false ||
      user.is_fake === true ||
      user.password_hash == null
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isActiveBan =
      user.banned_at != null &&
      (user.banned_until == null || user.banned_until > new Date());
    if (isActiveBan) {
      throw new UnauthorizedException('Your account has been suspended');
    }
    if (user.email_verified_at == null) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    const refreshSecret = randomBytes(32).toString('hex');
    const refreshHash = await bcrypt.hash(refreshSecret, BCRYPT_ROUNDS);
    const refreshId = await this.authRepository.createRefreshToken(
      user.id,
      refreshHash,
    );

    return this.buildLoginResponse({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      photoUrl: user.photo_url ?? '',
      tenantId,
      refreshId,
      refreshSecret,
    });
  }

  async refresh(refreshToken: string): Promise<LoginResponseDto> {
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

      const refreshSecret = randomBytes(32).toString('hex');
      const refreshHash = await bcrypt.hash(refreshSecret, BCRYPT_ROUNDS);
      const newRefreshId = await this.authRepository.insertRefreshToken(
        client,
        row.user_id,
        refreshHash,
      );

      return this.buildLoginResponse({
        userId: row.user_id,
        name: row.name,
        email: row.email,
        role: row.role,
        photoUrl: row.photo_url ?? '',
        tenantId: row.tenant_id,
        refreshId: newRefreshId,
        refreshSecret,
      });
    });
  }

  private buildLoginResponse(params: {
    userId: string;
    name: string;
    email: string;
    role: string;
    photoUrl: string;
    tenantId: string;
    refreshId: string;
    refreshSecret: string;
  }): LoginResponseDto {
    const expiresInStr = this.config.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '10m',
    );
    const expiresIn = parseExpiresInToSeconds(expiresInStr);

    const accessToken = this.jwtService.sign(
      { sub: params.userId, role: params.role, tenantId: params.tenantId },
      { expiresIn: expiresInStr },
    );

    return {
      accessToken,
      refreshToken: `${params.refreshId}.${params.refreshSecret}`,
      expiresIn,
      user: {
        id: params.userId,
        name: params.name,
        email: params.email,
        role: params.role,
        photoUrl: params.photoUrl,
      },
    };
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

    const appDomain = this.config.getOrThrow<string>('TENANT_HOST_SUFFIX');
    const protocol = appDomain.includes('localhost') ? 'http' : 'https';
    const resetLink = `${protocol}://${tenantSlug}.${appDomain}/reset-password?token=${encodeURIComponent(fullToken)}`;

    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.name,
      resetLink,
    );
  }

  async resendVerificationEmail(
    dto: ResendVerificationEmailDto,
    tenantId: string,
    tenantSlug: string,
  ): Promise<void> {
    const user =
      await this.usersRepository.findActiveUnverifiedByEmailForTenant(
        tenantId,
        dto.email,
      );
    if (!user) {
      return;
    }

    await this.sendEmailVerificationLink(
      user.id,
      user.email,
      user.name,
      tenantSlug,
    );
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersRepository.findPasswordHashById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.authRepository.runInTransaction(async (client) => {
      await this.usersRepository.updatePasswordHash(client, userId, newHash);

      if (dto.revokeOtherSessions) {
        await this.authRepository.deleteRefreshTokensByUserId(client, userId);
      }
    });

    return { message: 'Password changed successfully' };
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

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const parts = dto.token.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const [id, secret] = parts;

    return this.authRepository.runInTransaction(async (client) => {
      const row = await this.authRepository.findEmailVerificationTokenForUpdate(
        client,
        id,
      );
      if (!row) {
        throw new BadRequestException('Invalid or expired verification token');
      }

      const hashValid = await bcrypt.compare(secret, row.token_hash);
      if (!hashValid) {
        throw new BadRequestException('Invalid or expired verification token');
      }

      await this.usersRepository.markEmailVerified(client, row.user_id);
      await this.authRepository.markEmailVerificationTokenUsed(client, id);
      await this.authRepository.deleteEmailVerificationTokensByUserId(
        client,
        row.user_id,
      );

      return { message: 'Email verified successfully' };
    });
  }

  private async sendEmailVerificationLink(
    userId: string,
    email: string,
    userName: string,
    tenantSlug: string,
  ): Promise<void> {
    await this.authRepository.deleteEmailVerificationTokensForUser(userId);

    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(plainToken, BCRYPT_ROUNDS);
    const verifyId = await this.authRepository.createEmailVerificationToken(
      userId,
      tokenHash,
    );
    const fullToken = `${verifyId}.${plainToken}`;

    const appDomain = this.config.getOrThrow<string>('TENANT_HOST_SUFFIX');
    const protocol = appDomain.includes('localhost') ? 'http' : 'https';
    const verificationLink = `${protocol}://${tenantSlug}.${appDomain}/verify-email?token=${encodeURIComponent(fullToken)}`;

    await this.emailService.sendEmailVerificationEmail(
      email,
      userName,
      verificationLink,
    );
  }
}
