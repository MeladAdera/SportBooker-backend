import { ApiProperty } from '@nestjs/swagger';

export class TenantDeactivatedResponseDto {
  @ApiProperty({ example: 'Tenant deactivated' })
  message!: string;
}
