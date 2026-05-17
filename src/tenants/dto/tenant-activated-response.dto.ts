import { ApiProperty } from '@nestjs/swagger';

export class TenantActivatedResponseDto {
  @ApiProperty({ example: 'Tenant activated' })
  message!: string;
}
