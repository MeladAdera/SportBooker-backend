import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { AuthRepository } from '../auth/auth.repository';
import { BookingsRepository } from '../bookings/bookings.repository';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UserRole } from './user-role';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let authRepository: jest.Mocked<
    Pick<AuthRepository, 'runInTransaction' | 'deleteRefreshTokensByUserId'>
  >;
  let repository: jest.Mocked<
    Pick<
      UsersRepository,
      | 'findByIdInTenant'
      | 'findByIdForSelfProfile'
      | 'hasUpcomingConfirmedBookings'
      | 'patchSelfProfile'
      | 'softDeleteAccount'
      | 'updateRole'
    >
  >;
  let bookingsRepository: jest.Mocked<
    Pick<BookingsRepository, 'countMyBookingsForUser' | 'findMyBookingsForUser'>
  >;

  const tenantId = 'tenant-uuid';
  const targetId = 'target-uuid';
  const actorId = 'actor-uuid';

  const baseRow = {
    id: targetId,
    tenant_id: tenantId,
    name: 'User',
    email: 'u@test.com',
    role: UserRole.TenantStaff,
    is_active: true,
    deleted_at: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-02'),
  };

  beforeEach(() => {
    authRepository = {
      runInTransaction: jest.fn(
        async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> =>
          fn({} as PoolClient),
      ) as jest.Mocked<AuthRepository>['runInTransaction'],
      deleteRefreshTokensByUserId: jest.fn(),
    };
    repository = {
      findByIdInTenant: jest.fn(),
      findByIdForSelfProfile: jest.fn(),
      hasUpcomingConfirmedBookings: jest.fn(),
      patchSelfProfile: jest.fn(),
      softDeleteAccount: jest.fn(),
      updateRole: jest.fn(),
    };
    bookingsRepository = {
      countMyBookingsForUser: jest.fn().mockResolvedValue(0),
      findMyBookingsForUser: jest.fn().mockResolvedValue([]),
    };
    service = new UsersService(
      repository as unknown as UsersRepository,
      authRepository as unknown as AuthRepository,
      bookingsRepository as unknown as BookingsRepository,
    );
  });

  it('throws NotFound when user not in tenant', async () => {
    repository.findByIdInTenant.mockResolvedValue(null);

    await expect(
      service.assignRole({
        actorUserId: actorId,
        actorRole: UserRole.TenantAdmin,
        tenantId,
        targetUserId: targetId,
        newRole: UserRole.Player,
      }),
    ).rejects.toThrow(NotFoundException);

    expect(repository.updateRole).not.toHaveBeenCalled();
  });

  it('throws Forbidden when tenant_admin targets a super_admin user', async () => {
    repository.findByIdInTenant.mockResolvedValue({
      ...baseRow,
      role: UserRole.SuperAdmin,
    });

    await expect(
      service.assignRole({
        actorUserId: actorId,
        actorRole: UserRole.TenantAdmin,
        tenantId,
        targetUserId: targetId,
        newRole: UserRole.TenantStaff,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(repository.updateRole).not.toHaveBeenCalled();
  });

  it('throws BadRequest when demoting yourself', async () => {
    repository.findByIdInTenant.mockResolvedValue({
      ...baseRow,
      id: actorId,
      role: UserRole.TenantAdmin,
    });

    await expect(
      service.assignRole({
        actorUserId: actorId,
        actorRole: UserRole.TenantAdmin,
        tenantId,
        targetUserId: actorId,
        newRole: UserRole.TenantStaff,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(repository.updateRole).not.toHaveBeenCalled();
  });

  it('updates role when super_admin assigns tenant_staff', async () => {
    repository.findByIdInTenant.mockResolvedValue({
      ...baseRow,
      role: UserRole.Player,
    });
    repository.updateRole.mockResolvedValue({
      ...baseRow,
      role: UserRole.TenantStaff,
      updated_at: new Date('2024-01-03'),
    });

    const result = await service.assignRole({
      actorUserId: actorId,
      actorRole: UserRole.SuperAdmin,
      tenantId,
      targetUserId: targetId,
      newRole: UserRole.TenantStaff,
    });

    expect(result.role).toBe(UserRole.TenantStaff);
    expect(repository.updateRole).toHaveBeenCalledWith(
      tenantId,
      targetId,
      UserRole.TenantStaff,
    );
  });

  it('throws BadRequest when super_admin demotes self to tenant_admin', async () => {
    repository.findByIdInTenant.mockResolvedValue({
      ...baseRow,
      id: actorId,
      role: UserRole.SuperAdmin,
    });

    await expect(
      service.assignRole({
        actorUserId: actorId,
        actorRole: UserRole.SuperAdmin,
        tenantId,
        targetUserId: actorId,
        newRole: UserRole.TenantAdmin,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  describe('getMyProfile', () => {
    it('returns profile without internal fields', async () => {
      repository.findByIdForSelfProfile.mockResolvedValue({
        id: actorId,
        name: 'Player One',
        email: 'p@test.com',
        phone: '+15550001',
        photo_url: 'https://cdn.example/a.png',
        role: UserRole.Player,
        wallet_balance: '42.50',
        created_at: new Date('2024-01-01'),
        deleted_at: null,
      });

      const result = await service.getMyProfile({
        tenantId,
        userId: actorId,
      });

      expect(result).toEqual({
        id: actorId,
        name: 'Player One',
        email: 'p@test.com',
        phone: '+15550001',
        photoUrl: 'https://cdn.example/a.png',
        role: UserRole.Player,
        walletBalance: 42.5,
        createdAt: new Date('2024-01-01'),
      });
    });

    it('throws Unauthorized when user not in tenant', async () => {
      repository.findByIdForSelfProfile.mockResolvedValue(null);

      await expect(
        service.getMyProfile({ tenantId, userId: actorId }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized when user is soft-deleted', async () => {
      repository.findByIdForSelfProfile.mockResolvedValue({
        id: actorId,
        name: 'Gone',
        email: 'g@test.com',
        phone: null,
        photo_url: null,
        role: UserRole.Player,
        wallet_balance: '0.00',
        created_at: new Date('2024-01-01'),
        deleted_at: new Date('2024-06-01'),
      });

      await expect(
        service.getMyProfile({ tenantId, userId: actorId }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  const profileRow = {
    id: actorId,
    name: 'Player One',
    email: 'p@test.com',
    phone: '+15550001',
    photo_url: 'https://cdn.example/a.png',
    role: UserRole.Player,
    wallet_balance: '42.50',
    created_at: new Date('2024-01-01'),
    deleted_at: null as Date | null,
  };

  describe('updateMyProfile', () => {
    it('maps dto fields to repository patch and returns profile', async () => {
      repository.patchSelfProfile.mockResolvedValue({
        ...profileRow,
        name: 'New Name',
        phone: '+1999',
        photo_url: 'https://cdn.example/b.png',
      });

      const dto: UpdateMyProfileDto = {
        name: 'New Name',
        phone: '+1999',
        photoUrl: 'https://cdn.example/b.png',
      };

      const result = await service.updateMyProfile({
        tenantId,
        userId: actorId,
        dto,
      });

      expect(repository.patchSelfProfile).toHaveBeenCalledWith(
        tenantId,
        actorId,
        {
          name: 'New Name',
          phone: '+1999',
          photo_url: 'https://cdn.example/b.png',
        },
      );
      expect(result.name).toBe('New Name');
      expect(result.phone).toBe('+1999');
      expect(result.photoUrl).toBe('https://cdn.example/b.png');
    });

    it('passes empty patch when dto has no keys set', async () => {
      repository.patchSelfProfile.mockResolvedValue(profileRow);

      await service.updateMyProfile({
        tenantId,
        userId: actorId,
        dto: {},
      });

      expect(repository.patchSelfProfile).toHaveBeenCalledWith(
        tenantId,
        actorId,
        {},
      );
    });

    it('throws Unauthorized when patch returns null', async () => {
      repository.patchSelfProfile.mockResolvedValue(null);

      await expect(
        service.updateMyProfile({
          tenantId,
          userId: actorId,
          dto: { name: 'X' },
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized when row is soft-deleted', async () => {
      repository.patchSelfProfile.mockResolvedValue({
        ...profileRow,
        deleted_at: new Date('2024-06-01'),
      });

      await expect(
        service.updateMyProfile({
          tenantId,
          userId: actorId,
          dto: { name: 'X' },
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('listMyBookings', () => {
    it('returns paginated items and maps pending to waitlisted', async () => {
      repository.findByIdForSelfProfile.mockResolvedValue(profileRow);
      bookingsRepository.countMyBookingsForUser.mockResolvedValue(1);
      bookingsRepository.findMyBookingsForUser.mockResolvedValue([
        {
          id: 'b1',
          status: 'pending',
          paid_amount: '0',
          match_title: 'Sunday',
          sport_type: 'football',
          scheduled_at: new Date('2026-12-01T12:00:00.000Z'),
          venue_name: 'Main',
          created_at: new Date('2026-03-01T12:00:00.000Z'),
        },
      ]);

      const result = await service.listMyBookings({
        tenantId,
        userId: actorId,
        query: { page: 1, limit: 20 },
      });

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.total).toBe(1);
      expect(result.items[0]?.status).toBe('waitlisted');
      expect(result.items[0]?.matchTitle).toBe('Sunday');
      expect(bookingsRepository.countMyBookingsForUser).toHaveBeenCalledWith({
        tenantId,
        userId: actorId,
        status: undefined,
        upcoming: undefined,
      });
    });

    it('throws Unauthorized when profile missing', async () => {
      repository.findByIdForSelfProfile.mockResolvedValue(null);

      await expect(
        service.listMyBookings({
          tenantId,
          userId: actorId,
          query: {},
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('deleteMyAccount', () => {
    it('returns message and runs soft delete + refresh token removal in transaction', async () => {
      repository.hasUpcomingConfirmedBookings.mockResolvedValue(false);
      repository.softDeleteAccount.mockResolvedValue(true);

      const result = await service.deleteMyAccount({
        tenantId,
        userId: actorId,
      });

      expect(result).toEqual({ message: 'Account deleted' });
      expect(authRepository.runInTransaction).toHaveBeenCalled();
      expect(repository.hasUpcomingConfirmedBookings).toHaveBeenCalled();
      expect(repository.softDeleteAccount).toHaveBeenCalled();
      expect(authRepository.deleteRefreshTokensByUserId).toHaveBeenCalled();
    });

    it('throws Conflict when upcoming confirmed bookings exist', async () => {
      repository.hasUpcomingConfirmedBookings.mockResolvedValue(true);

      await expect(
        service.deleteMyAccount({ tenantId, userId: actorId }),
      ).rejects.toThrow(ConflictException);

      expect(repository.softDeleteAccount).not.toHaveBeenCalled();
      expect(authRepository.deleteRefreshTokensByUserId).not.toHaveBeenCalled();
    });

    it('throws Unauthorized when soft delete matches no row', async () => {
      repository.hasUpcomingConfirmedBookings.mockResolvedValue(false);
      repository.softDeleteAccount.mockResolvedValue(false);

      await expect(
        service.deleteMyAccount({ tenantId, userId: actorId }),
      ).rejects.toThrow(UnauthorizedException);

      expect(authRepository.deleteRefreshTokensByUserId).not.toHaveBeenCalled();
    });
  });
});
