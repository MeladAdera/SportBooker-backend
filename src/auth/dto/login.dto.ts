import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  MinLength,
  registerDecorator,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  type ValidationOptions,
} from 'class-validator';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

@ValidatorConstraint({ name: 'isEmailOrPhone', async: false })
class IsEmailOrPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return EMAIL_REGEX.test(value) || E164_REGEX.test(value);
  }

  defaultMessage(): string {
    return 'identifier must be a valid email address or E.164 phone number (e.g. +9639XXXXXXXX)';
  }
}

function IsEmailOrPhone(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsEmailOrPhoneConstraint,
    });
  };
}

export class LoginDto {
  @ApiProperty({
    example: 'player@acfc.test',
    description: 'Email address or E.164 phone number (e.g. +9639XXXXXXXX)',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsEmailOrPhone()
  identifier!: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Password',
    minLength: 8,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(8)
  password!: string;
}
