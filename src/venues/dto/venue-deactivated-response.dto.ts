import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VenueDeactivatedResponseDto {
  @ApiProperty({ example: 'Venue deactivated' })
  message!: string;

  @ApiProperty()
  venueId!: string;

  @ApiPropertyOptional({
    description: 'Present when the venue was already inactive',
  })
  alreadyInactive?: boolean;
}
