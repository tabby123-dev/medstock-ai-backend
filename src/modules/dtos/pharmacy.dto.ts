import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class ApprovePharmacyDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectPharmacyDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class PharmacyResponseDto {
  id: string;
  name: string;
  location: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PharmacyManagerRequestDto {
  id: string;
  pharmacy: PharmacyResponseDto;
  manager: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  };
  createdAt: Date;
}