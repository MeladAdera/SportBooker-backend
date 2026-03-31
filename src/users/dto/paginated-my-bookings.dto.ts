import { ApiProperty } from '@nestjs/swagger';
import { MyBookingItemDto } from './my-booking-item.dto';

export class PaginatedMyBookingsDto {
  @ApiProperty({ type: [MyBookingItemDto] })
  items!: MyBookingItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;
}
