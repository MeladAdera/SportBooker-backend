import { ApiProperty } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty({ example: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'John Doe' })
  name!: string;

  @ApiProperty({ example: 'john@acfc.test' })
  email!: string;

  @ApiProperty({ example: 'player', enum: ['player'] })
  role!: string;

  @ApiProperty()
  createdAt!: Date;
}
