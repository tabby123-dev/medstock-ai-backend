import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import {
  Medicine,
  MedicineSchema,
  StockMovement,
  StockMovementSchema,
  Alert,
  AlertSchema,
} from '../../schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Medicine.name, schema: MedicineSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: Alert.name, schema: AlertSchema },
    ]),
  ],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
