import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import {
  Medicine,
  MedicineSchema,
  Pharmacy,
  PharmacySchema,
  User,
  UserSchema,
} from '../../schemas';
import { LoggerModule } from 'src/common/logger/logger.module';
import { MailModule } from 'src/common/utils/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Pharmacy.name, schema: PharmacySchema },
      { name: Medicine.name, schema: MedicineSchema },
    ]),
    LoggerModule,
    MailModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
