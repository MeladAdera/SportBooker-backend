import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthRepository } from '../auth/auth.repository';
import { BookingsRepository } from '../bookings/bookings.repository';
import type { MyBookingHistoryRow } from '../bookings/bookings.repository';
import type { VenueSportType } from '../venues/venue-sport-type';
import type { AssignableRole } from './user-role';
import { roleRank } from './user-role';
import type { AccountDeletedResponseDto } from './dto/account-deleted-response.dto';
import type { MyBookingItemDto } from './dto/my-booking-item.dto';
import type { MyBookingsQueryDto } from './dto/my-bookings-query.dto';
import type { MyProfileResponseDto } from './dto/my-profile-response.dto';
import type { PaginatedMyBookingsDto } from './dto/paginated-my-bookings.dto';
import type { PaginatedTenantUsersDto } from './dto/paginated-tenant-users.dto';
import type { ListTenantUsersQueryDto } from './dto/list-tenant-users-query.dto';
import type { MyWalletResponseDto } from './dto/my-wallet-response.dto';
import type { TenantUserDetailDto } from './dto/tenant-user-detail.dto';
import type { TenantUserListItemDto } from './dto/tenant-user-list-item.dto';
import type { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import type { UserResponseDto } from './dto/user-response.dto';
import type { WalletQueryDto } from './dto/wallet-query.dto';
import type {
  WalletTransactionApiType,
  WalletTransactionItemDto,
} from './dto/wallet-transaction-item.dto';
import type {
  TenantUserDetailRow,
  TenantUserListRow,
  UserSelfProfileRow,
} from './users.repository';
import { UsersRepository } from './users.repository';
import type { WalletTransactionRow } from './wallet.repository';
import { WalletRepository } from './wallet.repository';

export const UPCOMING_BOOKINGS_BLOCK_DELETE_MESSAGE =
  'You have confirmed upcoming bookings. Cancel them before deleting your account.';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authRepository: AuthRepository,
    private readonly bookingsRepository: BookingsRepository,
    private readonly walletRepository: WalletRepository,
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

    if (
      actorRole === 'tenant_admin' &&
      (target.role === 'super_admin' || target.role === 'platform_admin')
    ) {
      throw new ForbiddenException(
        'Cannot change role for users with super_admin or platform_admin role',
      );
    }

    if (actorRole === 'super_admin' && target.role === 'platform_admin') {
      throw new ForbiddenException(
        'Cannot change role for users with platform_admin role',
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
   * Tenant-scoped user list for tenant_admin / tenant_staff.
   * includeDeleted=true only allowed for tenant_admin.
   */
  async listTenantUsers(params: {
    tenantId: string;
    actorRole: string;
    query: ListTenantUsersQueryDto;
  }): Promise<PaginatedTenantUsersDto> {
    const { tenantId, actorRole, query } = params;
    if (
      actorRole !== 'super_admin' &&
      actorRole !== 'tenant_admin' &&
      actorRole !== 'tenant_staff'
    ) {
      throw new ForbiddenException('Insufficient role');
    }
    const includeDeleted = query.includeDeleted === true;
    if (
      includeDeleted &&
      actorRole !== 'super_admin' &&
      actorRole !== 'tenant_admin'
    ) {
      throw new ForbiddenException(
        'Only tenant admins can include deleted users',
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const filter = {
      tenantId,
      role: query.role,
      isActive: query.isActive,
      includeDeleted,
    };

    const [total, rows] = await Promise.all([
      this.usersRepository.countTenantUsers(filter),
      this.usersRepository.findTenantUsers({ ...filter, limit, offset }),
    ]);

    return {
      page,
      limit,
      total,
      items: rows.map((row) => this.toTenantUserListItemDto(row)),
    };
  }

  /**
   * Single user in tenant for tenant_admin / tenant_staff. Missing or soft-deleted → 404.
   */
  async getTenantUserById(params: {
    tenantId: string;
    actorRole: string;
    targetUserId: string;
  }): Promise<TenantUserDetailDto> {
    const { tenantId, actorRole, targetUserId } = params;
    if (
      actorRole !== 'super_admin' &&
      actorRole !== 'tenant_admin' &&
      actorRole !== 'tenant_staff'
    ) {
      throw new ForbiddenException('Insufficient role');
    }
    const row = await this.usersRepository.findTenantUserDetailById(
      tenantId,
      targetUserId,
    );
    if (!row) {
      throw new NotFoundException('User not found in this tenant');
    }
    return this.toTenantUserDetailDto(row);
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
   * Paginated booking history for the current user (tenant-scoped via venue).
   */
  async listMyBookings(params: {
    tenantId: string;
    userId: string;
    query: MyBookingsQueryDto;
  }): Promise<PaginatedMyBookingsDto> {
    const { tenantId, userId, query } = params;

    const profile = await this.usersRepository.findByIdForSelfProfile(
      tenantId,
      userId,
    );
    if (!profile || profile.deleted_at != null) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const filter = {
      status: query.status,
      upcoming: query.upcoming,
    };

    const [total, rows] = await Promise.all([
      this.bookingsRepository.countMyBookingsForUser({
        tenantId,
        userId,
        ...filter,
      }),
      this.bookingsRepository.findMyBookingsForUser({
        tenantId,
        userId,
        limit,
        offset,
        ...filter,
      }),
    ]);

    return {
      page,
      limit,
      total,
      items: rows.map((row) => this.toMyBookingItemDto(row)),
    };
  }

  /**
   * Wallet balance (from users.wallet_balance) and paginated transaction history.
   */
  async getMyWallet(params: {
    tenantId: string;
    userId: string;
    query: WalletQueryDto;
  }): Promise<MyWalletResponseDto> {
    const { tenantId, userId, query } = params;

    const profile = await this.usersRepository.findByIdForSelfProfile(
      tenantId,
      userId,
    );
    if (!profile || profile.deleted_at != null) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const [balanceStr, total, rows] = await Promise.all([
      this.walletRepository.findWalletBalanceForUser(tenantId, userId),
      this.walletRepository.countWalletTransactionsForUser(tenantId, userId),
      this.walletRepository.findWalletTransactionsForUser({
        tenantId,
        userId,
        limit,
        offset,
      }),
    ]);

    if (balanceStr === null) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return {
      balance: Number(balanceStr),
      page,
      limit,
      total,
      transactions: rows.map((row) => this.toWalletTransactionItem(row)),
    };
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

  private toWalletTransactionItem(
    row: WalletTransactionRow,
  ): WalletTransactionItemDto {
    const apiType = UsersService.mapDbWalletTypeToApi(row.type);
    return {
      id: row.id,
      type: apiType,
      amount: row.amount,
      description: UsersService.walletTxDescription(apiType),
      reference: row.reference_id,
      createdAt: row.created_at.toISOString(),
    };
  }

  private static mapDbWalletTypeToApi(db: string): WalletTransactionApiType {
    switch (db) {
      case 'debit':
        return 'deduction';
      case 'refund':
        return 'refund';
      case 'topup':
        return 'topup';
      case 'credit':
      default:
        return 'credit';
    }
  }

  private static walletTxDescription(
    apiType: WalletTransactionApiType,
  ): string {
    switch (apiType) {
      case 'deduction':
        return 'Match booking payment';
      case 'refund':
        return 'Match cancellation refund';
      case 'topup':
        return 'Wallet top-up';
      case 'credit':
        return 'Wallet credit';
      default:
        return 'Transaction';
    }
  }

  private toMyBookingItemDto(row: MyBookingHistoryRow): MyBookingItemDto {
    const status = row.status === 'pending' ? 'waitlisted' : row.status;
    return {
      id: row.id,
      status,
      paidAmount: row.paid_amount,
      matchTitle: row.match_title,
      sportType: row.sport_type as VenueSportType,
      matchScheduledAt: row.scheduled_at.toISOString(),
      venueName: row.venue_name,
      createdAt: row.created_at.toISOString(),
    };
  }

  private toTenantUserListItemDto(
    row: TenantUserListRow,
  ): TenantUserListItemDto {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      isActive: row.is_active,
      walletBalance: Number(row.wallet_balance),
      createdAt: row.created_at.toISOString(),
    };
  }

  private toTenantUserDetailDto(row: TenantUserDetailRow): TenantUserDetailDto {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      photoUrl: row.photo_url,
      role: row.role,
      isActive: row.is_active,
      walletBalance: Number(row.wallet_balance),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
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
