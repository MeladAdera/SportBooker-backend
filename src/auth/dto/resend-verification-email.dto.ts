import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendVerificationEmailDto {
  @ApiProperty({
    example: 'john@acfc.test',
    description: 'Account email to resend verification link for',
  })
  @IsEmail()
  email!: string;
}
