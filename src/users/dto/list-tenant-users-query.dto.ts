import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === '' || value === null) {
    return undefined;
  }
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
}

/** Filter by user role (tenant-scoped roles only). */
export enum TenantUserRoleFilter {
  Player = 'player',
  TenantStaff = 'tenant_staff',
  TenantAdmin = 'tenant_admin',
}

export class ListTenantUsersQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive substring match on name or email.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: TenantUserRoleFilter })
  @IsOptional()
  @IsEnum(TenantUserRoleFilter)
  role?: TenantUserRoleFilter;

  @ApiPropertyOptional({ description: 'Filter by active flag' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseOptionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Include soft-deleted users. Only tenant_admin may set true; tenant_staff receives 403.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseOptionalBoolean(value))
  @IsBoolean()
  includeDeleted?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter by ban status. true = only currently banned players; false = only non-banned players; omit = all.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseOptionalBoolean(value))
  @IsBoolean()
  isBanned?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter by fake-player flag. true = only fake demo players; false = only real users; omit = all (default).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseOptionalBoolean(value))
  @IsBoolean()
  isFake?: boolean;
}
