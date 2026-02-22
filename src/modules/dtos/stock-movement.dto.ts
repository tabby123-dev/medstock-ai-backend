import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MovementType, MovementReason } from '../schemas';

export class CreateStockMovementDto {
  @IsMongoId()
  @IsNotEmpty()
  medicine_id: string;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  quantity: number;

  @IsEnum(MovementType)
  @IsNotEmpty()
  movementType: MovementType;

  @IsEnum(MovementReason)
  @IsOptional()
  reason?: MovementReason;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  reference?: string;
}

export class StockMovementResponseDto {
  id: string;
  quantity: number;
  movementType: MovementType;
  reason?: MovementReason;
  balanceAfter: number;
  notes?: string;
  reference?: string;
  medicine: {
    id: string;
    name: string;
    currentStock: number;
  };
  recordedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: Date;
}