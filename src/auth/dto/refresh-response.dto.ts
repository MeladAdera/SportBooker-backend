import { ApiProperty } from '@nestjs/swagger';

export class RefreshResponseDto {
  @ApiProperty({ description: 'New JWT access token' })
  accessToken!: string;

  @ApiProperty({ description: 'New refresh token (old one is invalidated)' })
  refreshToken!: string;

  @ApiProperty({ description: 'Access token expiry in seconds', example: 900 })
  expiresIn!: number;
}
