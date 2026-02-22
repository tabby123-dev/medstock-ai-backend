import {
    Controller,
    Get,
    Post,
    Body,
    Query,
    UseGuards,
  } from '@nestjs/common';
  import { StaffService } from './staff.service';
  import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
  import { RolesGuard } from '../../auth/guards/roles.guard';
  import { Roles } from '../../../common/decorators/roles.decorator';
  import { CurrentUser } from '../../../common/decorators/current-user.decorator';
  import { UserRole, User } from '../../schemas';
  import { CreateMedicineDto, CreateStockMovementDto } from '../../dtos';
  
  @Controller('staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF)
  export class StaffController {
    constructor(private readonly staffService: StaffService) {}
  
    // MEDICINE MANAGEMENT
  
    @Post('medicines/submit')
    submitMedicine(
      @CurrentUser() user: User,
      @Body() dto: CreateMedicineDto,
    ) {
      return this.staffService.submitMedicine(user, dto);
    }
  
    @Get('medicines')
    getMyMedicines(
      @CurrentUser() user: User,
      @Query('status') status?: string,
    ) {
      return this.staffService.getMyMedicines(user, status);
    }
  
    // STOCK MOVEMENTS
  
    @Post('stock-movements')
    recordStockMovement(
      @CurrentUser() user: User,
      @Body() dto: CreateStockMovementDto,
    ) {
      return this.staffService.recordStockMovement(user, dto);
    }
  
    @Get('stock-movements')
    getStockMovements(
      @CurrentUser() user: User,
      @Query('medicine_id') medicineId?: string,
    ) {
      return this.staffService.getStockMovements(user, medicineId);
    }
  
    // ALERTS
  
    @Get('alerts')
    getAlerts(
      @CurrentUser() user: User,
      @Query('status') status?: string,
      @Query('type') type?: string,
    ) {
      return this.staffService.getAlerts(user, status, type);
    }
  }