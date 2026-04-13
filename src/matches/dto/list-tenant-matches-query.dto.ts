import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { VenueSportType } from '../../venues/venue-sport-type';

export enum OperatorMatchStatus {
  Upcoming = 'upcoming',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export class ListTenantMatchesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: OperatorMatchStatus })
  @IsOptional()
  @IsEnum(OperatorMatchStatus)
  status?: OperatorMatchStatus;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @MinLength(10)
  @MaxLength(10)
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @MinLength(10)
  @MaxLength(10)
  dateTo?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  venueId?: string;

  @ApiPropertyOptional({ enum: VenueSportType })
  @IsOptional()
  @IsEnum(VenueSportType)
  sportType?: VenueSportType;

  @ApiPropertyOptional({
    description: 'Title substring search (case-insensitive)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;
}
