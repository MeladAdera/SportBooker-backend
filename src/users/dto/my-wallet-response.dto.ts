import { ApiProperty } from '@nestjs/swagger';
import { WalletTransactionItemDto } from './wallet-transaction-item.dto';

export class MyWalletResponseDto {
  @ApiProperty({ example: 125.5 })
  balance!: number;

  @ApiProperty({ type: [WalletTransactionItemDto] })
  transactions!: WalletTransactionItemDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;
}
