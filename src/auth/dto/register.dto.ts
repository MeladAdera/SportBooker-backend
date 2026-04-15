import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { E164_STRING_REGEX } from '../register-phone.util';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({
    example: 'john@acfc.test',
    description: 'Email (unique per tenant)',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
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
    example: '+963998163901',
    description:
      'E.164 international format: leading +, then 2–15 digits (country + national, no spaces).',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(E164_STRING_REGEX)
  phone!: string;
}
