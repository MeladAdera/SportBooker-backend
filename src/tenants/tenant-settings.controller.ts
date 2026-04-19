import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ApiWrappedOkResponse } from '../common/decorators/api-wrapped-response.decorator';
import type { Tenant } from '../common/tenant.types';
import { Tenant as TenantDecorator } from '../auth/decorators/tenant.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantRequiredGuard } from '../auth/guards/tenant-required.guard';
import { UserRole } from '../users/user-role';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';
import { VenuePictureStorage } from '../venues/venue-picture.storage';

const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const logoMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (e: Error | null, accept: boolean) => void,
  ): void => {
    const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype);
    if (!ok) {
      cb(
        new BadRequestException('Logo must be JPEG, PNG, WebP, or GIF'),
        false,
      );
      return;
    }
    cb(null, true);
  },
};

@ApiTags('Tenant Settings')
@ApiBearerAuth()
@Controller('tenant')
@UseGuards(TenantRequiredGuard, RolesGuard)
@Roles(UserRole.SuperAdmin)
export class TenantSettingsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly pictureStorage: VenuePictureStorage,
  ) {}

  @Get('settings')
  @ApiOperation({
    summary: 'Get own tenant settings',
    description:
      'Super admin only. Returns full configuration for the tenant resolved from the request Host header.',
  })
  @ApiWrappedOkResponse({ type: TenantResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Super admin only' })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  async getSettings(
    @TenantDecorator() tenant: Tenant,
  ): Promise<TenantResponseDto> {
    return this.tenantsService.getTenantByIdForAdmin(tenant.id);
  }

  @Patch('settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update own tenant settings',
    description:
      'Super admin only. Partial update of the tenant resolved from the request Host header. Updatable fields: name, logoUrl, timezone, cancelCutoffHours. is_active is managed exclusively by platform_admin.',
  })
  @ApiWrappedOkResponse({ type: TenantResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Super admin only' })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  @ApiUnprocessableEntityResponse({
    description:
      'Ziina token saved but webhook registration failed (e.g. missing write_webhooks scope or non-public webhook URL)',
  })
  async updateSettings(
    @TenantDecorator() tenant: Tenant,
    @Body() dto: UpdateTenantDto,
  ): Promise<TenantResponseDto> {
    return this.tenantsService.updateTenantForAdmin(tenant.id, dto);
  }

  @Post('settings/logo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('logo', logoMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload tenant logo',
    description:
      'Super admin only. Uploads a logo image (JPEG, PNG, WebP, or GIF; max 2 MB) for the current tenant. ' +
      'Saves the file and updates logoUrl automatically. Returns updated tenant settings.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['logo'],
      properties: {
        logo: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiWrappedOkResponse({ type: TenantResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiForbiddenResponse({ description: 'Super admin only' })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  async uploadLogo(
    @TenantDecorator() tenant: Tenant,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<TenantResponseDto> {
    if (!file) {
      throw new BadRequestException('Logo file is required');
    }
    const logoUrl = await this.pictureStorage.saveTenantLogo(tenant.id, file);
    return this.tenantsService.updateTenantForAdmin(tenant.id, { logoUrl });
  }
}
