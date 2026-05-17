import { ApiProperty } from '@nestjs/swagger';
export class RegisterResponseDto {
  @ApiProperty({
    description:
      'Registration result message. User must verify email before login.',
  })
  message!: string;

  @ApiProperty({
    description: 'Indicates that email verification is required',
    example: true,
  })
  emailVerificationRequired!: boolean;
}
