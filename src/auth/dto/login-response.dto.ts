import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT access token for Authorization header' })
  accessToken!: string;

  @ApiProperty({ description: 'Refresh token for obtaining new access token' })
  refreshToken!: string;

  @ApiProperty({ description: 'Access token expiry in seconds', example: 900 })
  expiresIn!: number;
}
