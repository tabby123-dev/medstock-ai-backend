import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum MovementType {
  IN = 'IN',
  OUT = 'OUT',
}

export enum MovementReason {
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  RETURN = 'RETURN',
  EXPIRED = 'EXPIRED',
  DAMAGED = 'DAMAGED',
  TRANSFER = 'TRANSFER',
  ADJUSTMENT = 'ADJUSTMENT',
}

@Schema({ timestamps: true })
export class StockMovement extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Medicine', required: true })
  medicine: Types.ObjectId;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true, enum: MovementType })
  movementType: MovementType;

  @Prop({ enum: MovementReason })
  reason?: MovementReason;

  @Prop({ required: true })
  balanceAfter: number;

  @Prop()
  notes?: string;

  @Prop()
  reference?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recordedBy: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);