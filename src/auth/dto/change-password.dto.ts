import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword123!' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ example: 'NewPassword123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;

  @ApiProperty({
    example: true,
    description: 'Revoke all other refresh tokens (sign out other devices)',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  revokeOtherSessions?: boolean;
}
