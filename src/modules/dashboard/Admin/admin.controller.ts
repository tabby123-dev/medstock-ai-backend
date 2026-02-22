import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../schemas';
import {
  ApprovePharmacyDto,
  RejectPharmacyDto,
  PharmacyManagerRequestDto,
  PharmacyResponseDto,
} from '../../dtos/pharmacy.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('pharmacy-manager-requests')
  async getPharmacyManagerRequests(
    @Query('status') status?: string,
  ): Promise<PharmacyManagerRequestDto[]> {
    return this.adminService.getPharmacyManagerRequests(status);
  }

  @Post('pharmacy-manager-requests/:id/approve')
  async approvePharmacyManagerRequest(
    @Param('id') id: string,
    @Body() approveDto: ApprovePharmacyDto,
  ): Promise<{ message: string; pharmacy: PharmacyResponseDto }> {
    return this.adminService.approvePharmacyManagerRequest(id, approveDto);
  }

  @Post('pharmacy-manager-requests/:id/reject')
  async rejectPharmacyManagerRequest(
    @Param('id') id: string,
    @Body() rejectDto: RejectPharmacyDto,
  ): Promise<{ message: string }> {
    return this.adminService.rejectPharmacyManagerRequest(id, rejectDto);
  }

  @Get('users')
  async getAllUsers(
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getAllUsers(role, status);
  }

  @Get('pharmacies')
  async getAllPharmacies(@Query('status') status?: string) {
    return this.adminService.getAllPharmacies(status);
  }

  @Get('pharmacies/:id/inventory')
  async getPharmacyInventory(@Param('id') id: string) {
    return this.adminService.getPharmacyInventory(id);
  }
}
