import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Express } from 'express';
import { VenueSportType } from './venue-sport-type';
import { VenuePictureStorage } from './venue-picture.storage';
import { VenuesRepository } from './venues.repository';
import { VenuesService } from './venues.service';

describe('VenuesService', () => {
  let service: VenuesService;
  let repository: jest.Mocked<
    Pick<
      VenuesRepository,
      | 'insertVenue'
      | 'countActiveVenuesForBrowse'
      | 'findActiveVenuesForBrowse'
      | 'findActiveVenueByIdForTenant'
      | 'patchVenueForTenant'
      | 'findVenueRowByIdForTenant'
      | 'countBlockingMatchesForVenue'
      | 'deactivateVenueForTenant'
    >
  >;
  let storage: jest.Mocked<Pick<VenuePictureStorage, 'saveVenuePicture'>>;

  const tenantId = '550e8400-e29b-41d4-a716-446655440000';

  const row = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    tenant_id: tenantId,
    name: 'Court A',
    address: '1 Road',
    maps_url: 'https://maps.example.com/x',
    picture_url: 'https://cdn.example.com/v.jpg',
    sport_types: ['football', 'padel'],
    is_active: true,
    created_at: new Date('2025-01-01T00:00:00.000Z'),
    updated_at: new Date('2025-01-02T00:00:00.000Z'),
  };

  const browseRow = {
    id: '770e8400-e29b-41d4-a716-446655440002',
    name: 'Browse Court',
    address: '3 Lane',
    maps_url: 'https://maps.example.com/browse',
    sport_types: ['football'],
    is_active: true,
  };

  const mockFile = {
    fieldname: 'picture',
    originalname: 'a.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('x'),
    size: 1,
    destination: '',
    filename: '',
    path: '',
  } as Express.Multer.File;

  beforeEach(() => {
    repository = {
      insertVenue: jest.fn(),
      countActiveVenuesForBrowse: jest.fn(),
      findActiveVenuesForBrowse: jest.fn(),
      findActiveVenueByIdForTenant: jest.fn(),
      patchVenueForTenant: jest.fn(),
      findVenueRowByIdForTenant: jest.fn(),
      countBlockingMatchesForVenue: jest.fn(),
      deactivateVenueForTenant: jest.fn(),
    };
    storage = {
      saveVenuePicture: jest.fn(),
    };
    service = new VenuesService(
      repository as unknown as VenuesRepository,
      storage as unknown as VenuePictureStorage,
    );
  });

  describe('create', () => {
    it('creates a venue using pictureUrl and maps response fields', async () => {
      repository.insertVenue.mockResolvedValue(row);

      const result = await service.create(tenantId, {
        name: '  Court A  ',
        address: '1 Road',
        mapsUrl: 'https://maps.example.com/x',
        pictureUrl: 'https://cdn.example.com/v.jpg',
        sportTypes: '["football","padel"]',
      });

      expect(repository.insertVenue).toHaveBeenCalledWith(tenantId, {
        name: 'Court A',
        address: '1 Road',
        mapsUrl: 'https://maps.example.com/x',
        pictureUrl: 'https://cdn.example.com/v.jpg',
        sportTypes: [VenueSportType.Football, VenueSportType.Padel],
      });
      expect(result).toEqual({
        id: row.id,
        tenantId,
        name: 'Court A',
        address: '1 Road',
        mapsUrl: 'https://maps.example.com/x',
        pictureUrl: 'https://cdn.example.com/v.jpg',
        sportTypes: ['football', 'padel'],
        isActive: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
      });
    });

    it('throws BadRequest when neither pictureUrl nor picture file is provided', async () => {
      await expect(
        service.create(tenantId, {
          name: 'Solo',
          address: '9 Lane',
          mapsUrl: 'https://maps.example.com/solo',
          sportTypes: '["generic"]',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.insertVenue).not.toHaveBeenCalled();
    });

    it('throws ConflictException on unique venue name per tenant', async () => {
      repository.insertVenue.mockRejectedValue({ code: '23505' });

      await expect(
        service.create(tenantId, {
          name: 'Dup',
          address: '1 St',
          mapsUrl: 'https://maps.example.com/dup',
          pictureUrl: 'https://cdn.example.com/a.jpg',
          sportTypes: '["football"]',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('uses file and ignores pictureUrl when both are provided', async () => {
      const fileUrl = 'http://localhost:3000/uploads/venues/t/u.jpg';
      storage.saveVenuePicture.mockResolvedValue(fileUrl);
      repository.insertVenue.mockResolvedValue({
        ...row,
        picture_url: fileUrl,
      });

      await service.create(
        tenantId,
        {
          name: 'With file',
          address: '2 St',
          mapsUrl: 'https://maps.example.com/with-file',
          pictureUrl: 'https://cdn.example.com/ignored.jpg',
          sportTypes: '["football"]',
        },
        mockFile,
      );

      expect(storage.saveVenuePicture).toHaveBeenCalled();
      expect(repository.insertVenue).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ pictureUrl: fileUrl }),
      );
    });

    it('saves uploaded file and stores returned URL', async () => {
      const fileUrl = 'http://localhost:3000/uploads/venues/t/u.jpg';
      storage.saveVenuePicture.mockResolvedValue(fileUrl);
      repository.insertVenue.mockResolvedValue({
        ...row,
        picture_url: fileUrl,
      });

      await service.create(
        tenantId,
        {
          name: 'With file',
          address: '2 St',
          mapsUrl: 'https://maps.example.com/with-file',
          sportTypes: '["football"]',
        },
        mockFile,
      );

      expect(storage.saveVenuePicture).toHaveBeenCalled();
      expect(repository.insertVenue).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ pictureUrl: fileUrl }),
      );
    });

    it('throws BadRequest for invalid sportTypes JSON', async () => {
      await expect(
        service.create(tenantId, {
          name: 'X',
          address: '1 St',
          mapsUrl: 'https://maps.example.com/x',
          pictureUrl: 'https://cdn.example.com/a.jpg',
          sportTypes: 'not-json',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.insertVenue).not.toHaveBeenCalled();
    });

    it('throws BadRequest for unknown sport type', async () => {
      await expect(
        service.create(tenantId, {
          name: 'X',
          address: '1 St',
          mapsUrl: 'https://maps.example.com/x',
          pictureUrl: 'https://cdn.example.com/a.jpg',
          sportTypes: '["unknown_sport"]',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.insertVenue).not.toHaveBeenCalled();
    });

    it('throws BadRequest for empty sportTypes array', async () => {
      await expect(
        service.create(tenantId, {
          name: 'X',
          address: '1 St',
          mapsUrl: 'https://maps.example.com/x',
          pictureUrl: 'https://cdn.example.com/a.jpg',
          sportTypes: '[]',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.insertVenue).not.toHaveBeenCalled();
    });
  });

  describe('getByIdForTenant', () => {
    const detailRow = {
      id: '880e8400-e29b-41d4-a716-446655440003',
      name: 'Detail Court',
      address: '99 St',
      maps_url: 'https://maps.example.com/detail',
      sport_types: ['cricket'],
      is_active: true,
      picture_url: 'https://cdn.example.com/p.jpg',
    };

    it('returns venue detail when found in tenant', async () => {
      repository.findActiveVenueByIdForTenant.mockResolvedValue(detailRow);

      const result = await service.getByIdForTenant(tenantId, detailRow.id);

      expect(repository.findActiveVenueByIdForTenant).toHaveBeenCalledWith(
        detailRow.id,
        tenantId,
      );
      expect(result).toEqual({
        id: detailRow.id,
        name: detailRow.name,
        address: detailRow.address,
        mapsUrl: detailRow.maps_url,
        sportTypes: ['cricket'],
        isActive: true,
        pictureUrl: 'https://cdn.example.com/p.jpg',
      });
    });

    it('throws NotFound when venue missing or other tenant', async () => {
      repository.findActiveVenueByIdForTenant.mockResolvedValue(null);

      await expect(
        service.getByIdForTenant(
          tenantId,
          '990e8400-e29b-41d4-a716-446655440004',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivateForTenant', () => {
    const venueId = row.id;

    it('throws NotFound when venue not in tenant', async () => {
      repository.findVenueRowByIdForTenant.mockResolvedValue(null);

      await expect(
        service.deactivateForTenant(tenantId, venueId),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns already inactive without counting matches', async () => {
      repository.findVenueRowByIdForTenant.mockResolvedValue({
        ...row,
        is_active: false,
      });

      const result = await service.deactivateForTenant(tenantId, venueId);

      expect(result).toMatchObject({
        message: 'Venue was already inactive',
        venueId,
        alreadyInactive: true,
      });
      expect(repository.countBlockingMatchesForVenue).not.toHaveBeenCalled();
      expect(repository.deactivateVenueForTenant).not.toHaveBeenCalled();
    });

    it('throws Conflict when blocking matches exist', async () => {
      repository.findVenueRowByIdForTenant.mockResolvedValue(row);
      repository.countBlockingMatchesForVenue.mockResolvedValue(3);

      await expect(
        service.deactivateForTenant(tenantId, venueId),
      ).rejects.toThrow(ConflictException);

      expect(repository.deactivateVenueForTenant).not.toHaveBeenCalled();
    });

    it('deactivates when no blocking matches', async () => {
      repository.findVenueRowByIdForTenant.mockResolvedValue(row);
      repository.countBlockingMatchesForVenue.mockResolvedValue(0);
      repository.deactivateVenueForTenant.mockResolvedValue({
        ...row,
        is_active: false,
      });

      const result = await service.deactivateForTenant(tenantId, venueId);

      expect(result).toEqual({
        message: 'Venue deactivated',
        venueId: row.id,
      });
      expect(repository.deactivateVenueForTenant).toHaveBeenCalledWith(
        tenantId,
        venueId,
      );
    });
  });

  describe('updateForTenant', () => {
    const venueId = row.id;

    it('throws BadRequest when body is empty', async () => {
      await expect(
        service.updateForTenant(tenantId, venueId, {}),
      ).rejects.toThrow(BadRequestException);
      expect(repository.patchVenueForTenant).not.toHaveBeenCalled();
    });

    it('throws NotFound when venue not in tenant', async () => {
      repository.patchVenueForTenant.mockResolvedValue(null);

      await expect(
        service.updateForTenant(tenantId, venueId, { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns updated venue and maps conflict on unique name', async () => {
      const updated = {
        ...row,
        name: 'Renamed',
        updated_at: new Date('2025-01-03T00:00:00.000Z'),
      };
      repository.patchVenueForTenant.mockResolvedValue(updated);

      const result = await service.updateForTenant(tenantId, venueId, {
        name: 'Renamed',
      });

      expect(repository.patchVenueForTenant).toHaveBeenCalledWith(
        tenantId,
        venueId,
        { name: 'Renamed' },
      );
      expect(result.name).toBe('Renamed');
      expect(result.tenantId).toBe(tenantId);
    });

    it('throws ConflictException on unique violation', async () => {
      repository.patchVenueForTenant.mockRejectedValue({ code: '23505' });

      await expect(
        service.updateForTenant(tenantId, venueId, { name: 'Dup' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listForBrowse', () => {
    it('returns paginated browse items; default page 1, limit 50', async () => {
      repository.countActiveVenuesForBrowse.mockResolvedValue(1);
      repository.findActiveVenuesForBrowse.mockResolvedValue([browseRow]);

      const result = await service.listForBrowse(tenantId, {});

      expect(repository.countActiveVenuesForBrowse).toHaveBeenCalledWith(
        tenantId,
        undefined,
      );
      expect(repository.findActiveVenuesForBrowse).toHaveBeenCalledWith(
        tenantId,
        undefined,
        50,
        0,
      );
      expect(result).toEqual({
        page: 1,
        limit: 50,
        total: 1,
        items: [
          {
            id: browseRow.id,
            name: browseRow.name,
            address: browseRow.address,
            mapsUrl: browseRow.maps_url,
            sportTypes: ['football'],
            isActive: true,
          },
        ],
      });
    });

    it('passes sportType, page, limit and offset to repository', async () => {
      repository.countActiveVenuesForBrowse.mockResolvedValue(120);
      repository.findActiveVenuesForBrowse.mockResolvedValue([]);

      await service.listForBrowse(tenantId, {
        sportType: VenueSportType.Padel,
        page: 3,
        limit: 20,
      });

      expect(repository.countActiveVenuesForBrowse).toHaveBeenCalledWith(
        tenantId,
        VenueSportType.Padel,
      );
      expect(repository.findActiveVenuesForBrowse).toHaveBeenCalledWith(
        tenantId,
        VenueSportType.Padel,
        20,
        40,
      );
    });
  });
});
