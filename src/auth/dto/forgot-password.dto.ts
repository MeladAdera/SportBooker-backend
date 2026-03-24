import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'player@acfc.test', description: 'Email address' })
  @IsEmail()
  email!: string;
}
