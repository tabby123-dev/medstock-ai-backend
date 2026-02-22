import { IsNotEmpty, IsString, IsOptional, IsNumber, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMedicineDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  genericName?: string;

  @IsString()
  @IsOptional()
  manufacturer?: string;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  currentStock?: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  unitPrice?: number;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class ApproveMedicineDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectMedicineDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class MedicineResponseDto {
  id: string;
  name: string;
  genericName?: string;
  manufacturer?: string;
  batchNumber?: string;
  currentStock: number;
  unit?: string;
  unitPrice?: number;
  expiryDate?: Date;
  category?: string;
  description?: string;
  status: string;
  rejectionReason?: string;
  submittedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}