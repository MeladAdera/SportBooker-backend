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

/** Query filter for booking history; `waitlisted` maps to DB `pending`. */
export enum MyBookingStatusFilter {
  Confirmed = 'confirmed',
  Cancelled = 'cancelled',
  Waitlisted = 'waitlisted',
}

export class MyBookingsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: MyBookingStatusFilter,
    description: 'Filter by booking status (waitlisted = pending waitlist)',
  })
  @IsOptional()
  @IsEnum(MyBookingStatusFilter)
  status?: MyBookingStatusFilter;

  @ApiPropertyOptional({
    description: 'If true, only matches with scheduled_at in the future',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseOptionalBoolean(value))
  @IsBoolean()
  upcoming?: boolean;
}
