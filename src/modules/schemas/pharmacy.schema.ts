import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum PharmacyStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

@Schema({ timestamps: true })
export class Pharmacy extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  location: string;

  @Prop()
  address?: string;

  @Prop()
  city?: string;

  @Prop()
  country?: string;

  @Prop({ required: true })
  contactEmail: string;

  @Prop({ required: true })
  contactPhone: string;

  @Prop()
  licenseNumber?: string;

  @Prop({
    required: true,
    enum: PharmacyStatus,
    default: PharmacyStatus.PENDING,
  })
  status: PharmacyStatus;

  @Prop()
  rejectionReason?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PharmacySchema = SchemaFactory.createForClass(Pharmacy);