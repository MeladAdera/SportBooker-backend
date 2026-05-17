import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { RESERVED_SLUGS } from '../common/constants/reserved-slugs';
import { UsersRepository } from '../users/users.repository';
import { TenantsRepository } from './tenants.repository';
import { TenantsService } from './tenants.service';

const defaultSuperAdmin = {
  name: 'Super Admin',
  email: 'super@example.com',
  password: 'Password123!',
};

describe('TenantsService', () => {
  let service: TenantsService;
  let repository: jest.Mocked<
    Pick<
      TenantsRepository,
      | 'insertTenant'
      | 'insertTenantWithinTransaction'
      | 'withTransaction'
      | 'findTenantById'
      | 'updateTenantById'
      | 'deactivateTenantById'
      | 'activateTenantById'
      | 'findTenantsForAdmin'
      | 'countTenantsForAdmin'
    >
  >;
  let usersRepository: jest.Mocked<
    Pick<UsersRepository, 'insertSuperAdminWithinTransaction'>
  >;

  const row = {
    id: 't1',
    name: 'New Co',
    slug: 'new-co',
    logo_url: null as string | null,
    timezone: 'Asia/Dubai',
    cancel_cutoff_hours: 24,
    is_active: true,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-02'),
  };

  const listRow = {
    id: 't1',
    name: 'New Co',
    slug: 'new-co',
    timezone: 'Asia/Dubai',
    cancel_cutoff_hours: 24,
    is_active: true,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-02'),
  };

  beforeEach(() => {
    usersRepository = {
      insertSuperAdminWithinTransaction: jest.fn().mockResolvedValue({
        id: 'u1',
        name: defaultSuperAdmin.name,
        email: defaultSuperAdmin.email,
        role: 'super_admin',
        created_at: new Date(),
      }),
    };
    repository = {
      insertTenant: jest.fn(),
      insertTenantWithinTransaction: jest.fn(),
      withTransaction: jest.fn(
        async (fn: (client: PoolClient) => Promise<unknown>) =>
          fn({} as PoolClient),
      ) as jest.Mocked<TenantsRepository>['withTransaction'],
      findTenantById: jest.fn(),
      updateTenantById: jest.fn(),
      deactivateTenantById: jest.fn(),
      activateTenantById: jest.fn(),
      findTenantsForAdmin: jest.fn(),
      countTenantsForAdmin: jest.fn(),
    };
    service = new TenantsService(
      repository as unknown as TenantsRepository,
      usersRepository as unknown as UsersRepository,
      {
        registerWebhookForTenant: jest.fn(),
      } as unknown as import('../payments/payments.service').PaymentsService,
      {
        encrypt: jest.fn((v: string) => v),
        decrypt: jest.fn((v: string) => v),
      } as unknown as import('../common/crypto/crypto.service').CryptoService,
    );
  });

  it('lists tenants with default page and limit', async () => {
    repository.countTenantsForAdmin.mockResolvedValue(1);
    repository.findTenantsForAdmin.mockResolvedValue([listRow]);

    const result = await service.listTenantsForAdmin({});

    expect(repository.countTenantsForAdmin).toHaveBeenCalledWith(null);
    expect(repository.findTenantsForAdmin).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      isActiveFilter: null,
    });
    expect(result).toMatchObject({
      page: 1,
      limit: 20,
      total: 1,
      items: [
        {
          id: 't1',
          name: 'New Co',
          slug: 'new-co',
          isActive: true,
          timezone: 'Asia/Dubai',
          cancelCutoffHours: 24,
        },
      ],
    });
  });

  it('returns full tenant by id for admin', async () => {
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    repository.findTenantById.mockResolvedValue({
      ...row,
      logo_url: 'https://cdn.example.com/logo.png',
    });

    const result = await service.getTenantByIdForAdmin(tenantId);

    expect(repository.findTenantById).toHaveBeenCalledWith(tenantId);
    expect(result).toMatchObject({
      id: 't1',
      name: 'New Co',
      slug: 'new-co',
      logoUrl: 'https://cdn.example.com/logo.png',
      timezone: 'Asia/Dubai',
      cancelCutoffHours: 24,
      isActive: true,
    });
  });

  it('throws NotFound when tenant id does not exist', async () => {
    const tenantId = '650e8400-e29b-41d4-a716-446655440000';
    repository.findTenantById.mockResolvedValue(null);

    await expect(service.getTenantByIdForAdmin(tenantId)).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.findTenantById).toHaveBeenCalledWith(tenantId);
  });

  const tenantId = '550e8400-e29b-41d4-a716-446655440000';

  it('throws NotFound when updating missing tenant', async () => {
    repository.findTenantById.mockResolvedValue(null);

    await expect(
      service.updateTenantForAdmin(tenantId, { name: 'X' }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.updateTenantById).not.toHaveBeenCalled();
  });

  it('returns unchanged tenant when patch body is empty', async () => {
    repository.findTenantById.mockResolvedValue(row);

    const result = await service.updateTenantForAdmin(tenantId, {});

    expect(repository.findTenantById).toHaveBeenCalledTimes(1);
    expect(repository.updateTenantById).not.toHaveBeenCalled();
    expect(result.slug).toBe('new-co');
  });

  it('applies partial update and returns updated tenant', async () => {
    repository.findTenantById.mockResolvedValue(row);
    const updated = {
      ...row,
      name: 'Renamed',
      cancel_cutoff_hours: 0,
      updated_at: new Date('2025-06-01'),
    };
    repository.updateTenantById.mockResolvedValue(updated);

    const result = await service.updateTenantForAdmin(tenantId, {
      name: 'Renamed',
      cancelCutoffHours: 0,
    });

    expect(repository.updateTenantById).toHaveBeenCalledWith(tenantId, {
      name: 'Renamed',
      cancelCutoffHours: 0,
    });
    expect(result.name).toBe('Renamed');
    expect(result.cancelCutoffHours).toBe(0);
  });

  it('deactivates active tenant', async () => {
    repository.findTenantById.mockResolvedValue({ ...row, is_active: true });
    repository.deactivateTenantById.mockResolvedValue({
      ...row,
      is_active: false,
    });

    const result = await service.deactivateTenantForAdmin(tenantId);

    expect(result).toEqual({ message: 'Tenant deactivated' });
    expect(repository.countTenantsForAdmin).not.toHaveBeenCalled();
    expect(repository.deactivateTenantById).toHaveBeenCalledWith(tenantId);
  });

  it('is idempotent when tenant already inactive', async () => {
    repository.findTenantById.mockResolvedValue({ ...row, is_active: false });

    const result = await service.deactivateTenantForAdmin(tenantId);

    expect(result).toEqual({ message: 'Tenant deactivated' });
    expect(repository.countTenantsForAdmin).not.toHaveBeenCalled();
    expect(repository.deactivateTenantById).not.toHaveBeenCalled();
  });

  it('throws NotFound when deactivating missing tenant', async () => {
    repository.findTenantById.mockResolvedValue(null);

    await expect(service.deactivateTenantForAdmin(tenantId)).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.deactivateTenantById).not.toHaveBeenCalled();
  });

  it('activates inactive tenant', async () => {
    repository.findTenantById.mockResolvedValue({ ...row, is_active: false });
    repository.activateTenantById.mockResolvedValue({
      ...row,
      is_active: true,
    });

    const result = await service.activateTenantForAdmin(tenantId);

    expect(result).toEqual({ message: 'Tenant activated' });
    expect(repository.activateTenantById).toHaveBeenCalledWith(tenantId);
  });

  it('is idempotent when tenant already active', async () => {
    repository.findTenantById.mockResolvedValue({ ...row, is_active: true });

    const result = await service.activateTenantForAdmin(tenantId);

    expect(result).toEqual({ message: 'Tenant activated' });
    expect(repository.activateTenantById).not.toHaveBeenCalled();
  });

  it('throws NotFound when activating missing tenant', async () => {
    repository.findTenantById.mockResolvedValue(null);

    await expect(service.activateTenantForAdmin(tenantId)).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.activateTenantById).not.toHaveBeenCalled();
  });

  it('applies isActive filter and pagination', async () => {
    repository.countTenantsForAdmin.mockResolvedValue(0);
    repository.findTenantsForAdmin.mockResolvedValue([]);

    await service.listTenantsForAdmin({
      page: 2,
      limit: 10,
      isActive: false,
    });

    expect(repository.countTenantsForAdmin).toHaveBeenCalledWith(false);
    expect(repository.findTenantsForAdmin).toHaveBeenCalledWith({
      limit: 10,
      offset: 10,
      isActiveFilter: false,
    });
  });

  it.each([...RESERVED_SLUGS])(
    'throws BadRequest when slug is reserved (%s)',
    async (slug) => {
      await expect(
        service.createTenant({
          name: 'X',
          slug,
          superAdmin: defaultSuperAdmin,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.withTransaction).not.toHaveBeenCalled();
    },
  );

  it('throws Conflict when slug unique constraint fails', async () => {
    repository.insertTenantWithinTransaction = jest
      .fn()
      .mockRejectedValue({ code: '23505' });

    await expect(
      service.createTenant({
        name: 'X',
        slug: 'taken-slug',
        superAdmin: defaultSuperAdmin,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('creates tenant with defaults', async () => {
    repository.insertTenantWithinTransaction = jest.fn().mockResolvedValue(row);

    const result = await service.createTenant({
      name: 'New Co',
      slug: 'new-co',
      superAdmin: defaultSuperAdmin,
    });

    expect(repository.insertTenantWithinTransaction).toHaveBeenCalledWith(
      {},
      {
        name: 'New Co',
        slug: 'new-co',
        logoUrl: null,
        timezone: 'Asia/Dubai',
        cancelCutoffHours: 24,
      },
    );
    expect(
      usersRepository.insertSuperAdminWithinTransaction,
    ).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        tenantId: 't1',
        name: defaultSuperAdmin.name,
        email: defaultSuperAdmin.email,
      }),
    );
    expect(
      (
        usersRepository.insertSuperAdminWithinTransaction.mock.calls[0][1] as {
          passwordHash: string;
        }
      ).passwordHash,
    ).toMatch(/^\$2[aby]\$/);
    expect(result).toMatchObject({
      id: 't1',
      name: 'New Co',
      slug: 'new-co',
      logoUrl: null,
      timezone: 'Asia/Dubai',
      cancelCutoffHours: 24,
      isActive: true,
    });
  });

  it('passes optional fields to repository', async () => {
    repository.insertTenantWithinTransaction = jest.fn().mockResolvedValue({
      ...row,
      logo_url: 'https://x.com/l.png',
      timezone: 'Europe/London',
      cancel_cutoff_hours: 48,
    });

    await service.createTenant({
      name: 'New Co',
      slug: 'new-co',
      logoUrl: 'https://x.com/l.png',
      timezone: 'Europe/London',
      cancelCutoffHours: 48,
      superAdmin: defaultSuperAdmin,
    });

    expect(repository.insertTenantWithinTransaction).toHaveBeenCalledWith(
      {},
      {
        name: 'New Co',
        slug: 'new-co',
        logoUrl: 'https://x.com/l.png',
        timezone: 'Europe/London',
        cancelCutoffHours: 48,
      },
    );
  });
});
