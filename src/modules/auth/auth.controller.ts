import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterAdminDto,
  RegisterManagerDto,
  LoginResponseDto,
} from '../dtos/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('admin/register')
  async registerAdmin(
    @Body() registerAdminDto: RegisterAdminDto,
  ): Promise<LoginResponseDto> {
    return this.authService.registerAdmin(registerAdminDto);
  }

  @Post('manager/register')
  async registerManager(
    @Body() registerManagerDto: RegisterManagerDto,
  ): Promise<{ message: string; requestId: string }> {
    return this.authService.registerManager(registerManagerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

}
