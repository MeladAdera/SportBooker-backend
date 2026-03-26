import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

/** PATCH /users/me — only these fields; others stripped by ValidationPipe whitelist. */
export class UpdateMyProfileDto {
  @ApiPropertyOptional({ minLength: 2 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Profile image URL (https recommended)',
    example: 'https://cdn.example.com/avatars/u1.png',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  photoUrl?: string;
}
