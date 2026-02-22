import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum MedicineStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Schema({ timestamps: true })
export class Medicine extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  genericName?: string;

  @Prop()
  manufacturer?: string;

  @Prop()
  batchNumber?: string;

  @Prop({ required: true, default: 0 })
  currentStock: number;

  @Prop()
  unit?: string;

  @Prop()
  unitPrice?: number;

  @Prop()
  expiryDate?: Date;

  @Prop()
  category?: string;

  @Prop()
  description?: string;

  @Prop({ required: true, enum: MedicineStatus, default: MedicineStatus.PENDING })
  status: MedicineStatus;

  @Prop()
  rejectionReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'Pharmacy', required: true })
  pharmacy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  submittedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop()
  approvedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const MedicineSchema = SchemaFactory.createForClass(Medicine);