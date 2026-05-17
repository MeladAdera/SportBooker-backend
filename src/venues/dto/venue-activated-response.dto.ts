import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VenueActivatedResponseDto {
  @ApiProperty({ example: 'Venue activated' })
  message!: string;

  @ApiProperty()
  venueId!: string;

  @ApiPropertyOptional({
    description: 'Present when the venue was already active',
  })
  alreadyActive?: boolean;
}
