import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ManagerService } from './manager.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserRole, User } from '../../schemas';
import {
  CreateStaffDto,
  ApproveMedicineDto,
  RejectMedicineDto,
} from '../../dtos';

@Controller('manager')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MANAGER)
export class ManagerController {
  constructor(private readonly managerService: ManagerService) {}

  //STAFF MANAGEMENT

  @Post('create-staff')
  createStaff(@CurrentUser() user: User, @Body() dto: CreateStaffDto) {
    return this.managerService.createStaff(user, dto);
  }

  @Get('my-staff')
  getStaff(@CurrentUser() user: User) {
    return this.managerService.getStaff(user);
  }

  // MEDICINE APPROVALS

  @Get('medicines')
  getMedicines(@CurrentUser() user: User, @Query('status') status?: string) {
    return this.managerService.getMedicines(user, status);
  }

  @Post('medicines/:id/approve')
  approveMedicine(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ApproveMedicineDto,
  ) {
    return this.managerService.approveMedicine(user, id, dto);
  }

  @Post('medicines/:id/reject')
  rejectMedicine(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: RejectMedicineDto,
  ) {
    return this.managerService.rejectMedicine(user, id, dto);
  }

  // ALERTS

  @Get('alerts')
  getAlerts(
    @CurrentUser() user: User,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.managerService.getAlerts(user, status, type);
  }

  // ANALYTICS

  @Get('analytics/fast-moving')
  getFastMoving(@CurrentUser() user: User, @Query('limit') limit?: string) {
    return this.managerService.getFastMovingMedicines(
      user,
      limit ? +limit : 10,
    );
  }

  @Get('analytics/slow-moving')
  getSlowMoving(@CurrentUser() user: User, @Query('limit') limit?: string) {
    return this.managerService.getSlowMovingMedicines(
      user,
      limit ? +limit : 10,
    );
  }

  // FORECASTING

  @Get('forecast')
  getForecast(
    @CurrentUser() user: User,
    @Query('medicine_id') medicineId: string,
    @Query('days') days?: string,
  ) {
    if (!medicineId) throw new BadRequestException('medicine_id is required');
    const d = days ? +days : 7;
    if (d < 1 || d > 90)
      throw new BadRequestException('days must be between 1 and 90');
    return this.managerService.getForecast(user, medicineId, d);
  }
}
