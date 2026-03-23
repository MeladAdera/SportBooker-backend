import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'player@acfc.test', description: 'Email' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Password',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
