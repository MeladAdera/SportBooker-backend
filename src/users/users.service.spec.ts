import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from './user-role';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<
    Pick<UsersRepository, 'findByIdInTenant' | 'updateRole'>
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
    repository = {
      findByIdInTenant: jest.fn(),
      updateRole: jest.fn(),
    };
    service = new UsersService(repository as unknown as UsersRepository);
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
});
