import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
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
}
