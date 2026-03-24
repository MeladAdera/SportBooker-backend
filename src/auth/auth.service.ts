import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import type { Pool } from 'pg';
import { DB_POOL } from '../database/database.constants';
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
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(
    dto: RegisterDto,
    tenantId: string,
  ): Promise<RegisterResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const sql = `
      INSERT INTO users (tenant_id, name, email, password_hash, phone, role)
      VALUES ($1, $2, $3, $4, $5, 'player')
      RETURNING id, name, email, role, created_at
    `;
    const values = [
      tenantId,
      dto.name,
      dto.email,
      passwordHash,
      dto.phone ?? null,
    ];

    try {
      const { rows } = await this.pool.query<{
        id: string;
        name: string;
        email: string;
        role: string;
        created_at: Date;
      }>(sql, values);

      const row = rows[0];
      if (!row) {
        throw new Error('Insert returned no row');
      }

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
    const { rows } = await this.pool.query<{
      id: string;
      email: string;
      role: string;
      password_hash: string;
      deleted_at: Date | null;
      is_active: boolean | null;
    }>(
      `SELECT id, email, role, password_hash, deleted_at, is_active
       FROM users
       WHERE tenant_id = $1 AND email = $2`,
      [tenantId, dto.email],
    );

    const user = rows[0];
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

    const { rows: rtRows } = await this.pool.query<{ id: string }>(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')
       RETURNING id`,
      [user.id, refreshHash],
    );
    const refreshId = rtRows[0]?.id;
    if (!refreshId) {
      throw new Error('Failed to create refresh token');
    }

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

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query<{
        user_id: string;
        token_hash: string;
        tenant_id: string;
        role: string;
      }>(
        `SELECT rt.user_id, rt.token_hash, u.tenant_id, u.role
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.id = $1 AND rt.expires_at > NOW()
         FOR UPDATE`,
        [id],
      );

      const row = rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        throw new UnauthorizedException('Invalid refresh token');
      }

      const hashValid = await bcrypt.compare(secret, row.token_hash);
      if (!hashValid) {
        await client.query('ROLLBACK');
        throw new UnauthorizedException('Invalid refresh token');
      }

      await client.query('DELETE FROM refresh_tokens WHERE id = $1', [id]);

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

      const { rows: rtRows } = await client.query<{ id: string }>(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '7 days')
         RETURNING id`,
        [row.user_id, refreshHash],
      );
      const newRefreshId = rtRows[0]?.id;
      if (!newRefreshId) {
        await client.query('ROLLBACK');
        throw new Error('Failed to create refresh token');
      }

      await client.query('COMMIT');

      const newRefreshToken = `${newRefreshId}.${refreshSecret}`;

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [
      userId,
    ]);
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
    tenantId: string,
    tenantSlug: string,
  ): Promise<void> {
    const { rows } = await this.pool.query<{ id: string; email: string }>(
      `SELECT id, email FROM users
       WHERE tenant_id = $1 AND email = $2 AND deleted_at IS NULL AND is_active = true`,
      [tenantId, dto.email],
    );

    const user = rows[0];
    if (!user) {
      return;
    }

    await this.pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [user.id],
    );

    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(plainToken, BCRYPT_ROUNDS);

    const { rows: rtRows } = await this.pool.query<{ id: string }>(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 HOUR')
       RETURNING id`,
      [user.id, tokenHash],
    );

    const resetId = rtRows[0]?.id;
    if (!resetId) {
      throw new Error('Failed to create password reset token');
    }

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

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query<{
        user_id: string;
        token_hash: string;
      }>(
        `SELECT user_id, token_hash
         FROM password_reset_tokens
         WHERE id = $1 AND expires_at > NOW() AND used_at IS NULL
         FOR UPDATE`,
        [id],
      );

      const row = rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        throw new BadRequestException('Invalid or expired reset token');
      }

      const hashValid = await bcrypt.compare(secret, row.token_hash);
      if (!hashValid) {
        await client.query('ROLLBACK');
        throw new BadRequestException('Invalid or expired reset token');
      }

      const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, row.user_id],
      );

      await client.query(
        'UPDATE password_reset_tokens SET used_at = NOW(), updated_at = NOW() WHERE id = $1',
        [id],
      );

      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [
        row.user_id,
      ]);

      await client.query('COMMIT');

      return { message: 'Password reset successfully' };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
