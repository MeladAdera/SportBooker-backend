import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** API-facing wallet line types (maps from DB wallet_tx_type). */
export type WalletTransactionApiType =
  | 'topup'
  | 'deduction'
  | 'refund'
  | 'credit';

export class WalletTransactionItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    enum: ['topup', 'deduction', 'refund', 'credit'],
    description:
      'Maps from DB: debit→deduction, refund→refund, credit→credit, topup→topup',
  })
  type!: WalletTransactionApiType;

  @ApiProperty({ example: '15.50' })
  amount!: string;

  @ApiProperty({ example: 'Match booking payment' })
  description!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reference!: string | null;

  @ApiProperty({ example: '2026-03-30T12:00:00.000Z' })
  createdAt!: string;
}
