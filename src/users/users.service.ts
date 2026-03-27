import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthRepository } from '../auth/auth.repository';
import type { AssignableRole } from './user-role';
import { roleRank } from './user-role';
import type { AccountDeletedResponseDto } from './dto/account-deleted-response.dto';
import type { MyProfileResponseDto } from './dto/my-profile-response.dto';
import type { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import type { UserResponseDto } from './dto/user-response.dto';
import type { UserSelfProfileRow } from './users.repository';
import { UsersRepository } from './users.repository';

export const UPCOMING_BOOKINGS_BLOCK_DELETE_MESSAGE =
  'You have confirmed upcoming bookings. Cancel them before deleting your account.';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authRepository: AuthRepository,
  ) {}

  /**
   * Assigns a role to a user in the same tenant as the actor.
   * - super_admin: may assign tenant_admin | tenant_staff | player; may manage any user in tenant
   * - tenant_admin: same assignable roles; cannot assign super_admin; cannot modify super_admin users
   * - Self-demotion (lowering own role) → 400
   */
  async assignRole(params: {
    actorUserId: string;
    actorRole: string;
    tenantId: string;
    targetUserId: string;
    newRole: AssignableRole;
  }): Promise<UserResponseDto> {
    const { actorUserId, actorRole, tenantId, targetUserId, newRole } = params;

    const target = await this.usersRepository.findByIdInTenant(
      tenantId,
      targetUserId,
    );
    if (!target) {
      throw new NotFoundException('User not found in this tenant');
    }

    if (actorRole === 'tenant_admin' && target.role === 'super_admin') {
      throw new ForbiddenException(
        'Cannot change role for users with super_admin role',
      );
    }

    if (actorUserId === targetUserId) {
      if (roleRank(newRole) < roleRank(target.role)) {
        throw new BadRequestException('Cannot demote yourself');
      }
    }

    const updated = await this.usersRepository.updateRole(
      tenantId,
      targetUserId,
      newRole,
    );
    if (!updated) {
      throw new NotFoundException('User not found in this tenant');
    }

    return this.toResponseDto(updated);
  }

  /**
   * Current user's profile in the tenant from JWT. Soft-deleted or unknown user → 401.
   */
  async getMyProfile(params: {
    tenantId: string;
    userId: string;
  }): Promise<MyProfileResponseDto> {
    const row = await this.usersRepository.findByIdForSelfProfile(
      params.tenantId,
      params.userId,
    );
    if (!row || row.deleted_at != null) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return this.toMyProfileDto(row);
  }

  /**
   * Updates optional profile fields; same response shape as GET /users/me.
   */
  async updateMyProfile(params: {
    tenantId: string;
    userId: string;
    dto: UpdateMyProfileDto;
  }): Promise<MyProfileResponseDto> {
    const { dto, tenantId, userId } = params;
    const patch: { name?: string; phone?: string; photo_url?: string } = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.photoUrl !== undefined) patch.photo_url = dto.photoUrl;

    const row = await this.usersRepository.patchSelfProfile(
      tenantId,
      userId,
      patch,
    );
    if (!row || row.deleted_at != null) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return this.toMyProfileDto(row);
  }

  /**
   * Soft-deletes the account and clears refresh tokens in one transaction.
   * Player-only at controller; 409 if confirmed future bookings exist.
   */
  async deleteMyAccount(params: {
    tenantId: string;
    userId: string;
  }): Promise<AccountDeletedResponseDto> {
    const { tenantId, userId } = params;

    return this.authRepository.runInTransaction(async (client) => {
      const hasUpcoming =
        await this.usersRepository.hasUpcomingConfirmedBookings(client, userId);
      if (hasUpcoming) {
        throw new ConflictException(UPCOMING_BOOKINGS_BLOCK_DELETE_MESSAGE);
      }

      const updated = await this.usersRepository.softDeleteAccount(
        client,
        tenantId,
        userId,
      );
      if (!updated) {
        throw new UnauthorizedException('Invalid or expired session');
      }

      await this.authRepository.deleteRefreshTokensByUserId(client, userId);

      return { message: 'Account deleted' };
    });
  }

  private toMyProfileDto(row: UserSelfProfileRow): MyProfileResponseDto {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      photoUrl: row.photo_url,
      role: row.role,
      walletBalance: Number(row.wallet_balance),
      createdAt: row.created_at,
    };
  }

  private toResponseDto(row: {
    id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }): UserResponseDto {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
