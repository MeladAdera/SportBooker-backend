import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export enum MatchSide {
  TeamA = 'team_a',
  TeamB = 'team_b',
}

export class PlayerStatEntryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ enum: MatchSide })
  @IsEnum(MatchSide)
  teamSide!: MatchSide;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  goals?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  assists?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isMvp?: boolean;
}

export class SubmitMatchResultsDto {
  @ApiPropertyOptional({
    enum: MatchSide,
    nullable: true,
    description: 'Omit or set to null for a draw',
  })
  @IsOptional()
  @IsEnum(MatchSide)
  winningSide?: MatchSide;

  @ApiProperty({ type: () => [PlayerStatEntryDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlayerStatEntryDto)
  players!: PlayerStatEntryDto[];
}
