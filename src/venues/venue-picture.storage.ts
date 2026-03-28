import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { Express } from 'express';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

@Injectable()
export class VenuePictureStorage {
  constructor(private readonly config: ConfigService) {}

  /** Base URL with no trailing slash (for absolute picture URLs in API responses). */
  getPublicBaseUrl(): string {
    const explicit = this.config.get<string>('PUBLIC_BASE_URL');
    if (explicit !== undefined && explicit.trim().length > 0) {
      return explicit.replace(/\/$/, '');
    }
    const port = this.config.get<number>('PORT', 3000);
    return `http://localhost:${port}`;
  }

  /**
   * Writes an uploaded image under uploads/venues/{tenantId}/ and returns a public URL.
   */
  async saveVenuePicture(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const ext = MIME_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Picture must be JPEG, PNG, WebP, or GIF');
    }
    const filename = `${randomUUID()}${ext}`;
    const relativeDir = join('venues', tenantId);
    const absoluteDir = join(process.cwd(), 'uploads', relativeDir);
    try {
      await mkdir(absoluteDir, { recursive: true });
      await writeFile(join(absoluteDir, filename), file.buffer);
    } catch {
      throw new InternalServerErrorException('Failed to save venue picture');
    }
    const base = this.getPublicBaseUrl();
    const urlPath = `${relativeDir.replace(/\\/g, '/')}/${filename}`;
    return `${base}/uploads/${urlPath}`;
  }
}
