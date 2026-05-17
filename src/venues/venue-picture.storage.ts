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
import { resolveApiPublicOrigin } from '../config/public-origins';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

@Injectable()
export class VenuePictureStorage {
  private readonly s3BucketName: string | undefined;
  private readonly s3Region: string | undefined;
  private s3Client: InstanceType<
    typeof import('@aws-sdk/client-s3').S3Client
  > | null = null;

  constructor(private readonly config: ConfigService) {
    this.s3BucketName = this.config.get<string>('S3_BUCKET_NAME');
    this.s3Region = this.config.get<string>('S3_REGION');
  }

  private async getS3Client() {
    if (this.s3Client) return this.s3Client;
    const { S3Client } = await import('@aws-sdk/client-s3');
    this.s3Client = new S3Client({ region: this.s3Region });
    return this.s3Client;
  }

  private get useS3(): boolean {
    return !!this.s3BucketName;
  }

  getPublicBaseUrl(): string {
    return resolveApiPublicOrigin(this.config);
  }

  async saveVenuePicture(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    return this.savePicture(`venues/${tenantId}`, file);
  }

  async saveUserPhoto(
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    return this.savePicture(`users/${userId}`, file);
  }

  async saveTenantLogo(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    return this.savePicture(`tenants/${tenantId}/logo`, file);
  }

  private async savePicture(
    folder: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const ext = MIME_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Photo must be JPEG, PNG, WebP, or GIF');
    }
    const key = `${folder}/${randomUUID()}${ext}`;

    if (this.useS3) {
      return this.saveToS3(key, file);
    }
    return this.saveToDisk(key, file);
  }

  private async saveToS3(
    key: string,
    file: Express.Multer.File,
  ): Promise<string> {
    try {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await this.getS3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: this.s3BucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      return `https://${this.s3BucketName}.s3.${this.s3Region}.amazonaws.com/${key}`;
    } catch {
      throw new InternalServerErrorException('Failed to save venue picture');
    }
  }

  private async saveToDisk(
    key: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const absolutePath = join(process.cwd(), 'uploads', key);
    const dir = join(absolutePath, '..');
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(absolutePath, file.buffer);
    } catch {
      throw new InternalServerErrorException('Failed to save venue picture');
    }
    const base = this.getPublicBaseUrl();
    return `${base}/uploads/${key}`;
  }
}
