import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token from email link' })
  @IsString()
  token!: string;

  @ApiProperty({
    example: 'NewPassword123!',
    description: 'New password (min 8 characters)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
