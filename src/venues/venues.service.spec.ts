import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Express } from 'express';
import { VenueSportType } from './venue-sport-type';
import { VenuePictureStorage } from './venue-picture.storage';
import { VenuesRepository } from './venues.repository';
import { VenuesService } from './venues.service';

describe('VenuesService', () => {
  let service: VenuesService;
  let repository: jest.Mocked<Pick<VenuesRepository, 'insertVenue'>>;
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

  beforeEach(() => {
    repository = {
      insertVenue: jest.fn(),
    };
    storage = {
      saveVenuePicture: jest.fn(),
    };
    service = new VenuesService(
      repository as unknown as VenuesRepository,
      storage as unknown as VenuePictureStorage,
    );
  });

  it('creates a venue and maps response fields', async () => {
    repository.insertVenue.mockResolvedValue(row);

    const result = await service.create(tenantId, {
      name: '  Court A  ',
      address: '1 Road',
      mapsUrl: 'https://maps.example.com/x',
      pictureUrl: 'https://cdn.example.com/v.jpg',
      sportTypes: [VenueSportType.Football, VenueSportType.Padel],
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

  it('allows null pictureUrl when address and mapsUrl are provided', async () => {
    repository.insertVenue.mockResolvedValue({
      ...row,
      picture_url: null,
    });

    const result = await service.create(tenantId, {
      name: 'Solo',
      address: '9 Lane',
      mapsUrl: 'https://maps.example.com/solo',
      sportTypes: [VenueSportType.Generic],
    });

    expect(repository.insertVenue).toHaveBeenCalledWith(tenantId, {
      name: 'Solo',
      address: '9 Lane',
      mapsUrl: 'https://maps.example.com/solo',
      pictureUrl: null,
      sportTypes: [VenueSportType.Generic],
    });
    expect(result.pictureUrl).toBeNull();
  });

  it('throws ConflictException on unique venue name per tenant', async () => {
    repository.insertVenue.mockRejectedValue({ code: '23505' });

    await expect(
      service.create(tenantId, {
        name: 'Dup',
        address: '1 St',
        mapsUrl: 'https://maps.example.com/dup',
        sportTypes: [VenueSportType.Football],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws BadRequest when both pictureUrl and file are provided', async () => {
    await expect(
      service.create(
        tenantId,
        {
          name: 'X',
          address: '1 St',
          mapsUrl: 'https://maps.example.com/x',
          pictureUrl: 'https://cdn.example.com/a.jpg',
          sportTypes: [VenueSportType.Football],
        },
        {
          fieldname: 'picture',
          originalname: 'a.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          buffer: Buffer.from(''),
          size: 0,
          stream: undefined as unknown as NodeJS.ReadableStream,
          destination: '',
          filename: '',
          path: '',
        } as Express.Multer.File,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(storage.saveVenuePicture).not.toHaveBeenCalled();
    expect(repository.insertVenue).not.toHaveBeenCalled();
  });

  it('saves uploaded file and stores returned URL', async () => {
    storage.saveVenuePicture.mockResolvedValue(
      'http://localhost:3000/uploads/venues/t/u.jpg',
    );
    repository.insertVenue.mockResolvedValue({
      ...row,
      picture_url: 'http://localhost:3000/uploads/venues/t/u.jpg',
    });

    await service.create(
      tenantId,
      {
        name: 'With file',
        address: '2 St',
        mapsUrl: 'https://maps.example.com/with-file',
        sportTypes: [VenueSportType.Football],
      },
      {
        fieldname: 'picture',
        originalname: 'a.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('x'),
        size: 1,
        stream: undefined as unknown as NodeJS.ReadableStream,
        destination: '',
        filename: '',
        path: '',
      } as Express.Multer.File,
    );

    expect(storage.saveVenuePicture).toHaveBeenCalled();
    expect(repository.insertVenue).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        pictureUrl: 'http://localhost:3000/uploads/venues/t/u.jpg',
      }),
    );
  });
});
