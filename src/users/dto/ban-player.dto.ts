import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** POST /users/:userId/ban */
export class BanPlayerDto {
  @ApiPropertyOptional({
    description: 'Number of days to ban. Omit or null for a permanent ban.',
    minimum: 1,
    example: 7,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @ApiPropertyOptional({
    description:
      'Internal reason for the ban (stored for audit; not shown to the player).',
    maxLength: 500,
    example: 'Repeated no-show without cancellation',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
