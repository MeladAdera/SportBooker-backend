import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RESERVED_SLUGS } from '../common/constants/reserved-slugs';
import { TenantsRepository } from './tenants.repository';
import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  let service: TenantsService;
  let repository: jest.Mocked<
    Pick<
      TenantsRepository,
      | 'insertTenant'
      | 'findTenantById'
      | 'updateTenantById'
      | 'deactivateTenantById'
      | 'findTenantsForAdmin'
      | 'countTenantsForAdmin'
    >
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
    repository = {
      insertTenant: jest.fn(),
      findTenantById: jest.fn(),
      updateTenantById: jest.fn(),
      deactivateTenantById: jest.fn(),
      findTenantsForAdmin: jest.fn(),
      countTenantsForAdmin: jest.fn(),
    };
    service = new TenantsService(repository as unknown as TenantsRepository);
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

  it('throws BadRequest when update includes slug', async () => {
    await expect(
      service.updateTenantForAdmin(tenantId, { slug: 'nope' }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.findTenantById).not.toHaveBeenCalled();
    expect(repository.updateTenantById).not.toHaveBeenCalled();
  });

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

  it('deactivates tenant when more than one active', async () => {
    repository.findTenantById.mockResolvedValue({ ...row, is_active: true });
    repository.countTenantsForAdmin.mockResolvedValue(2);
    repository.deactivateTenantById.mockResolvedValue({
      ...row,
      is_active: false,
    });

    const result = await service.deactivateTenantForAdmin(tenantId);

    expect(result).toEqual({ message: 'Tenant deactivated' });
    expect(repository.countTenantsForAdmin).toHaveBeenCalledWith(true);
    expect(repository.deactivateTenantById).toHaveBeenCalledWith(tenantId);
  });

  it('is idempotent when tenant already inactive', async () => {
    repository.findTenantById.mockResolvedValue({ ...row, is_active: false });

    const result = await service.deactivateTenantForAdmin(tenantId);

    expect(result).toEqual({ message: 'Tenant deactivated' });
    expect(repository.countTenantsForAdmin).not.toHaveBeenCalled();
    expect(repository.deactivateTenantById).not.toHaveBeenCalled();
  });

  it('throws BadRequest when deactivating the last active tenant', async () => {
    repository.findTenantById.mockResolvedValue({ ...row, is_active: true });
    repository.countTenantsForAdmin.mockResolvedValue(1);

    await expect(service.deactivateTenantForAdmin(tenantId)).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.deactivateTenantById).not.toHaveBeenCalled();
  });

  it('throws NotFound when deactivating missing tenant', async () => {
    repository.findTenantById.mockResolvedValue(null);

    await expect(service.deactivateTenantForAdmin(tenantId)).rejects.toThrow(
      NotFoundException,
    );
    expect(repository.deactivateTenantById).not.toHaveBeenCalled();
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
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.insertTenant).not.toHaveBeenCalled();
    },
  );

  it('throws Conflict when slug unique constraint fails', async () => {
    repository.insertTenant.mockRejectedValue({ code: '23505' });

    await expect(
      service.createTenant({
        name: 'X',
        slug: 'taken-slug',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('creates tenant with defaults', async () => {
    repository.insertTenant.mockResolvedValue(row);

    const result = await service.createTenant({
      name: 'New Co',
      slug: 'new-co',
    });

    expect(repository.insertTenant).toHaveBeenCalledWith({
      name: 'New Co',
      slug: 'new-co',
      logoUrl: null,
      timezone: 'Asia/Dubai',
      cancelCutoffHours: 24,
    });
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
    repository.insertTenant.mockResolvedValue({
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
    });

    expect(repository.insertTenant).toHaveBeenCalledWith({
      name: 'New Co',
      slug: 'new-co',
      logoUrl: 'https://x.com/l.png',
      timezone: 'Europe/London',
      cancelCutoffHours: 48,
    });
  });
});
