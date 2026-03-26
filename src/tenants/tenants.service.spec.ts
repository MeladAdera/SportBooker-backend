import { BadRequestException, ConflictException } from '@nestjs/common';
import { TenantsRepository } from './tenants.repository';
import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  let service: TenantsService;
  let repository: jest.Mocked<Pick<TenantsRepository, 'insertTenant'>>;

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

  beforeEach(() => {
    repository = {
      insertTenant: jest.fn(),
    };
    service = new TenantsService(repository as unknown as TenantsRepository);
  });

  it('throws BadRequest when slug is reserved', async () => {
    await expect(
      service.createTenant({
        name: 'X',
        slug: 'admin',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.insertTenant).not.toHaveBeenCalled();
  });

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
