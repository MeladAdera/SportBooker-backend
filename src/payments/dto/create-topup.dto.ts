import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class CreateTopupDto {
  @ApiProperty({
    description: 'Amount to top up in AED (e.g. 100 = 100 AED)',
    example: 100,
    minimum: 10,
    maximum: 5000,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(10)
  @Max(5000)
  amount!: number;
}
