import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email verification token in "<id>.<secret>" format',
  })
  @IsString()
  @MinLength(10)
  token!: string;
}
