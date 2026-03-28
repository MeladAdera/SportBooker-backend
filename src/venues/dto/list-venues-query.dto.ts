import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { VenueSportType } from '../venue-sport-type';

export class ListVenuesQueryDto {
  @ApiPropertyOptional({
    enum: VenueSportType,
    description:
      'If set, only venues whose sport_types array includes this value (PostgreSQL @>).',
  })
  @IsOptional()
  @IsEnum(VenueSportType)
  sportType?: VenueSportType;
}
