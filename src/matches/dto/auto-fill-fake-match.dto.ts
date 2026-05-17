import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/** Request body for POST /tenant/matches/:id/auto-fill-fake. */
export class AutoFillFakeMatchDto {
  @ApiPropertyOptional({
    example: 5,
    description:
      'Number of fake players to add. When omitted, the match is filled to ' +
      '(maxCapacity - minRealSpots). Capped at remaining capacity and remaining fake quota.',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  count?: number;
}
