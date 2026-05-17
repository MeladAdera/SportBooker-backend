import { ApiProperty } from '@nestjs/swagger';

export class AccountDeletedResponseDto {
  @ApiProperty({ example: 'Account deleted' })
  message!: string;
}
