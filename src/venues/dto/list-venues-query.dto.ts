import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { VenueSportType } from '../venue-sport-type';

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === '' || value === null) return undefined;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
}

export class ListVenuesQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: VenueSportType,
    description:
      'If set, only venues whose sport_types array includes this value (PostgreSQL @>).',
  })
  @IsOptional()
  @IsEnum(VenueSportType)
  sportType?: VenueSportType;

  @ApiPropertyOptional({
    description:
      'Tenant admin only. When true, includes deactivated venues in the response.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseOptionalBoolean(value))
  @IsBoolean()
  includeInactive?: boolean;
}
