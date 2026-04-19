import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Express } from 'express';
import { AuthRepository } from '../auth/auth.repository';
import { BookingsRepository } from '../bookings/bookings.repository';
import { EmailService } from '../auth/email.service';
import { VenuePictureStorage } from '../venues/venue-picture.storage';
import type { MyBookingHistoryRow } from '../bookings/bookings.repository';
import type { VenueSportType } from '../venues/venue-sport-type';
import type { AssignableRole } from './user-role';
import { roleRank } from './user-role';
import type { AccountDeletedResponseDto } from './dto/account-deleted-response.dto';
import type { BanPlayerDto } from './dto/ban-player.dto';
import type { BanPlayerResponseDto } from './dto/ban-player-response.dto';
import type { MyBookingItemDto } from './dto/my-booking-item.dto';
import type { MyBookingsQueryDto } from './dto/my-bookings-query.dto';
import type { MyProfileResponseDto } from './dto/my-profile-response.dto';
import type { UploadPhotoResponseDto } from './dto/upload-photo-response.dto';
import type { PaginatedMyBookingsDto } from './dto/paginated-my-bookings.dto';
import type { PaginatedTenantUsersDto } from './dto/paginated-tenant-users.dto';
import type { ListTenantUsersQueryDto } from './dto/list-tenant-users-query.dto';
import type { MyWalletResponseDto } from './dto/my-wallet-response.dto';
import type { TenantUserDetailDto } from './dto/tenant-user-detail.dto';
import type { TenantUserListItemDto } from './dto/tenant-user-list-item.dto';
import type { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import type { UserResponseDto } from './dto/user-response.dto';
import type { WalletQueryDto } from './dto/wallet-query.dto';
import { parseE164ToBigint } from '../auth/register-phone.util';
import { phoneE164FromDb } from './phone-from-db';
import type {
  WalletTransactionApiType,
  WalletTransactionItemDto,
} from './dto/wallet-transaction-item.dto';
import type {
  PlayerStatsRow,
  TenantUserDetailRow,
  TenantUserListRow,
  UserSelfProfileRow,
} from './users.repository';
import { UsersRepository } from './users.repository';
import type { PlayerStatsDto } from './dto/player-stats.dto';
import {
  DayOfWeek,
  DominantFoot,
  PlayerPosition,
  SkillLevel,
} from './player-profile.enums';
import type { WalletTransactionRow } from './wallet.repository';
import { WalletRepository } from './wallet.repository';

export const UPCOMING_BOOKINGS_BLOCK_DELETE_MESSAGE =
  'You have confirmed upcoming bookings. Cancel them before deleting your account.';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authRepository: AuthRepository,
    private readonly bookingsRepository: BookingsRepository,
    private readonly walletRepository: WalletRepository,
    private readonly pictureStorage: VenuePictureStorage,
    private readonly emailService: EmailService,
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
      isBanned: query.isBanned,
      isFake: query.isFake,
      includeDeleted,
      search: query.search,
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
    const [row, statsRow] = await Promise.all([
      this.usersRepository.findByIdForSelfProfile(
        params.tenantId,
        params.userId,
      ),
      this.usersRepository.computePlayerStats(params.userId, params.tenantId),
    ]);
    if (!row || row.deleted_at != null) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return this.toMyProfileDto(row, statsRow);
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
   * Paginated booking history for a specific player, viewed by tenant admin/staff.
   * Throws 404 if the target user is not found or doesn't belong to this tenant.
   */
  async listPlayerBookingsForOperator(params: {
    tenantId: string;
    targetUserId: string;
    query: MyBookingsQueryDto;
  }): Promise<PaginatedMyBookingsDto> {
    const { tenantId, targetUserId, query } = params;

    const user = await this.usersRepository.findByIdInTenant(
      tenantId,
      targetUserId,
    );
    if (!user) {
      throw new NotFoundException('User not found');
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
        userId: targetUserId,
        ...filter,
      }),
      this.bookingsRepository.findMyBookingsForUser({
        tenantId,
        userId: targetUserId,
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
    const patch: {
      name?: string;
      phone?: bigint;
      photo_url?: string;
      email?: string;
      date_of_birth?: string | null;
      nationality?: string | null;
      preferred_language?: string | null;
      skill_level?: string | null;
      preferred_position?: string | null;
      dominant_foot?: string | null;
      preferred_days?: string[];
    } = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.phone !== undefined) patch.phone = parseE164ToBigint(dto.phone);
    if (dto.photoUrl !== undefined) patch.photo_url = dto.photoUrl;
    if (dto.dateOfBirth !== undefined) patch.date_of_birth = dto.dateOfBirth;
    if (dto.nationality !== undefined) patch.nationality = dto.nationality;
    if (dto.preferredLanguage !== undefined)
      patch.preferred_language = dto.preferredLanguage;
    if (dto.skillLevel !== undefined) patch.skill_level = dto.skillLevel;
    if (dto.preferredPosition !== undefined)
      patch.preferred_position = dto.preferredPosition;
    if (dto.dominantFoot !== undefined) patch.dominant_foot = dto.dominantFoot;
    if (dto.preferredDays !== undefined)
      patch.preferred_days = dto.preferredDays;

    if (dto.email !== undefined) {
      const normalized = dto.email.trim().toLowerCase();
      const current = await this.usersRepository.findByIdForSelfProfile(
        tenantId,
        userId,
      );
      if (!current || current.deleted_at != null) {
        throw new UnauthorizedException('Invalid or expired session');
      }
      const currentNormalized = current.email.trim().toLowerCase();
      if (normalized !== currentNormalized) {
        const otherId: string | null =
          await this.usersRepository.findOtherUserIdByNormalizedEmail(
            tenantId,
            normalized,
            userId,
          );
        if (otherId) {
          throw new ConflictException('Email already in use for this tenant');
        }
        patch.email = normalized;
      }
    }

    let row: UserSelfProfileRow | null;
    try {
      row = await this.usersRepository.patchSelfProfile(
        tenantId,
        userId,
        patch,
      );
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('Email already in use for this tenant');
      }
      throw err;
    }
    if (!row || row.deleted_at != null) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const statsRow = await this.usersRepository.computePlayerStats(
      userId,
      tenantId,
    );
    return this.toMyProfileDto(row, statsRow);
  }

  /**
   * Saves a profile photo file and updates photo_url on the user row.
   * Returns the public URL of the uploaded photo.
   */
  async uploadMyPhoto(params: {
    tenantId: string;
    userId: string;
    file: Express.Multer.File;
  }): Promise<UploadPhotoResponseDto> {
    const { tenantId, userId, file } = params;

    const photoUrl = await this.pictureStorage.saveUserPhoto(userId, file);

    const row = await this.usersRepository.patchSelfProfile(tenantId, userId, {
      photo_url: photoUrl,
    });
    if (!row || row.deleted_at != null) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return { photoUrl };
  }

  /**
   * Bans a player in this tenant.
   * - Only players may be banned (not admins or staff).
   * - Actor's role must outrank the target's role.
   * - Cancels + refunds all upcoming confirmed and waitlisted bookings atomically.
   * - Revokes all refresh tokens so the session ends immediately.
   * - Sends a ban notification email after commit.
   */
  async banPlayer(params: {
    actorUserId: string;
    actorRole: string;
    tenantId: string;
    targetUserId: string;
    dto: BanPlayerDto;
  }): Promise<BanPlayerResponseDto> {
    const { actorUserId, actorRole, tenantId, targetUserId, dto } = params;

    if (actorUserId === targetUserId) {
      throw new BadRequestException('You cannot ban yourself');
    }

    const target = await this.usersRepository.findByIdInTenant(
      tenantId,
      targetUserId,
    );
    if (!target) {
      throw new NotFoundException('User not found in this tenant');
    }
    if (target.role !== 'player') {
      throw new BadRequestException('Only players can be banned');
    }
    if (roleRank(actorRole) <= roleRank(target.role)) {
      throw new ForbiddenException('Insufficient permissions to ban this user');
    }

    const bannedUntil: Date | null = dto.durationDays
      ? new Date(Date.now() + dto.durationDays * 24 * 60 * 60 * 1000)
      : null;
    const banReason: string | null = dto.reason ?? null;
    const bannedAt = new Date();

    const cancelledBookings = await this.authRepository.runInTransaction(
      async (client): Promise<number> => {
        const updated = await this.usersRepository.banUser(
          client,
          tenantId,
          targetUserId,
          bannedUntil,
          banReason,
        );
        if (!updated) {
          throw new NotFoundException('User not found in this tenant');
        }

        const cancelled =
          await this.usersRepository.bulkCancelAndRefundBookingsForBan(
            client,
            targetUserId,
            tenantId,
          );

        await this.authRepository.deleteRefreshTokensByUserId(
          client,
          targetUserId,
        );

        return cancelled.length;
      },
    );

    void this.promoteWaitlistAfterBan(tenantId, targetUserId);

    void this.emailService
      .sendAccountBannedEmail(target.email, bannedUntil)
      .catch((err: unknown) => {
        this.logger.warn(
          `sendAccountBannedEmail failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    return {
      userId: targetUserId,
      isBanned: true,
      bannedAt: bannedAt.toISOString(),
      bannedUntil: bannedUntil != null ? bannedUntil.toISOString() : null,
      banReason,
      cancelledBookings,
    };
  }

  private async promoteWaitlistAfterBan(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    try {
      const matchIds =
        await this.bookingsRepository.getMatchIdsWithFreedConfirmedSlotsForUser(
          tenantId,
          userId,
        );
      await Promise.all(
        matchIds.map((matchId) =>
          this.bookingsRepository
            .promoteWaitlistForMatch({ tenantId, matchId })
            .catch((err: unknown) => {
              this.logger.error(
                `promoteWaitlistForMatch failed after ban (matchId=${matchId}): ${err instanceof Error ? err.message : String(err)}`,
              );
            }),
        ),
      );
    } catch (err: unknown) {
      this.logger.error(
        `promoteWaitlistAfterBan failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Lifts a ban on a player. No-op if the player is not currently banned (idempotent).
   */
  async unbanPlayer(params: {
    actorRole: string;
    tenantId: string;
    targetUserId: string;
  }): Promise<BanPlayerResponseDto> {
    const { tenantId, targetUserId } = params;

    const target = await this.usersRepository.findByIdInTenant(
      tenantId,
      targetUserId,
    );
    if (!target) {
      throw new NotFoundException('User not found in this tenant');
    }
    if (target.role !== 'player') {
      throw new BadRequestException('Only players can be unbanned');
    }

    const updated = await this.usersRepository.unbanUser(
      tenantId,
      targetUserId,
    );
    if (!updated) {
      throw new NotFoundException('User not found in this tenant');
    }

    void this.emailService
      .sendAccountUnbannedEmail(target.email)
      .catch((err: unknown) => {
        this.logger.warn(
          `sendAccountUnbannedEmail failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    return {
      userId: targetUserId,
      isBanned: false,
      bannedAt: null,
      bannedUntil: null,
      banReason: null,
      cancelledBookings: 0,
    };
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
      matchId: row.match_id,
      status,
      paidAmount: row.paid_amount,
      matchTitle: row.match_title,
      sportType: row.sport_type as VenueSportType,
      matchScheduledAt: row.scheduled_at.toISOString(),
      venueName: row.venue_name,
      venuePictureUrl: row.venue_picture_url ?? '',
      createdAt: row.created_at.toISOString(),
    };
  }

  private toTenantUserListItemDto(
    row: TenantUserListRow,
  ): TenantUserListItemDto {
    const isBanned = UsersService.isActiveBan(row.banned_at, row.banned_until);
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      isActive: row.is_active,
      walletBalance: Number(row.wallet_balance),
      isBanned,
      isFake: row.is_fake,
      bannedUntil:
        isBanned && row.banned_until != null
          ? row.banned_until.toISOString()
          : null,
      createdAt: row.created_at.toISOString(),
    };
  }

  private toTenantUserDetailDto(row: TenantUserDetailRow): TenantUserDetailDto {
    const isBanned = UsersService.isActiveBan(row.banned_at, row.banned_until);
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: phoneE164FromDb(row.phone),
      photoUrl: row.photo_url,
      role: row.role,
      isActive: row.is_active,
      walletBalance: Number(row.wallet_balance),
      isBanned,
      isFake: row.is_fake,
      bannedAt:
        isBanned && row.banned_at != null ? row.banned_at.toISOString() : null,
      bannedUntil:
        isBanned && row.banned_until != null
          ? row.banned_until.toISOString()
          : null,
      banReason: isBanned ? (row.ban_reason ?? null) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static isActiveBan(
    bannedAt: Date | null,
    bannedUntil: Date | null,
  ): boolean {
    return (
      bannedAt != null && (bannedUntil == null || bannedUntil > new Date())
    );
  }

  private toMyProfileDto(
    row: UserSelfProfileRow,
    statsRow: PlayerStatsRow,
  ): MyProfileResponseDto {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: phoneE164FromDb(row.phone),
      photoUrl: row.photo_url,
      role: row.role,
      walletBalance: Number(row.wallet_balance),
      createdAt: row.created_at,
      dateOfBirth: row.date_of_birth,
      nationality: row.nationality,
      preferredLanguage: row.preferred_language,
      skillLevel: row.skill_level as SkillLevel | null,
      preferredPosition: row.preferred_position as PlayerPosition | null,
      dominantFoot: row.dominant_foot as DominantFoot | null,
      preferredDays: (row.preferred_days ?? []) as DayOfWeek[],
      stats: UsersService.toPlayerStatsDto(statsRow),
    };
  }

  private static toPlayerStatsDto(statsRow: PlayerStatsRow): PlayerStatsDto {
    return {
      matchesPlayed: parseInt(statsRow.matches_played, 10),
      wins: parseInt(statsRow.wins, 10),
      losses: parseInt(statsRow.losses, 10),
      draws: parseInt(statsRow.draws, 10),
      goalsScored: parseInt(statsRow.goals_scored, 10),
      assists: parseInt(statsRow.assists, 10),
      mvpAwards: parseInt(statsRow.mvp_awards, 10),
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
