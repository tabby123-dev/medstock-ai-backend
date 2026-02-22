import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ManagerController } from './manager.controller';
import { ManagerService } from './manager.service';
import {
  User,
  UserSchema,
  Medicine,
  MedicineSchema,
  StockMovement,
  StockMovementSchema,
  Alert,
  AlertSchema,
  Pharmacy,
  PharmacySchema,
} from '../../schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Medicine.name, schema: MedicineSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: Alert.name, schema: AlertSchema },
      { name: Pharmacy.name, schema: PharmacySchema },
    ]),
  ],
  controllers: [ManagerController],
  providers: [ManagerService],
})
export class ManagerModule {}
