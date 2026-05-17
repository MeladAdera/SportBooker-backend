import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty({
    description: 'User profile photo URL; empty string when none',
  })
  photoUrl!: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT access token for Authorization header' })
  accessToken!: string;

  @ApiProperty({ description: 'Refresh token for obtaining new access token' })
  refreshToken!: string;

  @ApiProperty({ description: 'Access token expiry in seconds', example: 900 })
  expiresIn!: number;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
