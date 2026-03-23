import { ConflictException, Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Pool } from 'pg';
import { DB_POOL } from '../database/database.constants';
import type { RegisterDto } from './dto/register.dto';
import type { RegisterResponseDto } from './dto/register-response.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

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
}
