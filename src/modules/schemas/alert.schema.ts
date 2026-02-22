import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum AlertType {
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  EXPIRING_SOON = 'EXPIRING_SOON',
  EXPIRED = 'EXPIRED',
  REORDER_POINT = 'REORDER_POINT',
  OVERSTOCK = 'OVERSTOCK',
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

@Schema({ timestamps: true })
export class Alert extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Pharmacy', required: true })
  pharmacy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Medicine' })
  medicine?: Types.ObjectId;

  @Prop({ required: true, enum: AlertType })
  type: AlertType;

  @Prop({ required: true, enum: AlertSeverity })
  severity: AlertSeverity;

  @Prop({ required: true, enum: AlertStatus, default: AlertStatus.ACTIVE })
  status: AlertStatus;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object })
  metadata?: any;

  @Prop()
  acknowledgedAt?: Date;

  @Prop()
  resolvedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AlertSchema = SchemaFactory.createForClass(Alert);