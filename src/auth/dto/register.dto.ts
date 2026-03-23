import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({
    example: 'john@acfc.test',
    description: 'Email (unique per tenant)',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Password (min 8 characters)',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'Phone (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;
}
