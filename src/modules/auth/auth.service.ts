import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  User,
  UserRole,
  UserStatus,
  Pharmacy,
  PharmacyStatus,
} from '../schemas';

import {
  LoginDto,
  RegisterAdminDto,
  RegisterManagerDto,
  LoginResponseDto,
} from '../dtos/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Pharmacy.name)
    private pharmacyModel: Model<Pharmacy>,
    private jwtService: JwtService,
  ) {}

  async registerAdmin(
    registerAdminDto: RegisterAdminDto,
  ): Promise<LoginResponseDto> {
    const existingUser = await this.userModel
      .findOne({ email: registerAdminDto.email })
      .exec();

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerAdminDto.password, 10);

    const admin = new this.userModel({
      email: registerAdminDto.email,
      password: hashedPassword,
      firstName: registerAdminDto.firstName,
      lastName: registerAdminDto.lastName,
      phoneNumber: registerAdminDto.phoneNumber,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });

    await admin.save();

    return this.generateLoginResponse(admin);
  }

  async registerManager(
    registerManagerDto: RegisterManagerDto,
  ): Promise<{ message: string; requestId: string }> {
    const existingUser = await this.userModel
      .findOne({ email: registerManagerDto.email })
      .exec();

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const pharmacy = new this.pharmacyModel({
      name: registerManagerDto.pharmacyName,
      location: registerManagerDto.pharmacyLocation,
      contactEmail: registerManagerDto.pharmacyContactEmail,
      contactPhone: registerManagerDto.pharmacyContactPhone,
      status: PharmacyStatus.PENDING,
    });

    const savedPharmacy = await pharmacy.save();

    const manager = new this.userModel({
      email: registerManagerDto.email,
      password: null,
      firstName: registerManagerDto.firstName,
      lastName: registerManagerDto.lastName,
      role: UserRole.MANAGER,
      status: UserStatus.PENDING,
      pharmacy: savedPharmacy._id,
    });

    await manager.save();

    return {
      message:
        'Registration request submitted successfully. Please wait for admin approval.',
      requestId: savedPharmacy._id.toString(),
    };
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.userModel
      .findOne({ email: loginDto.email })
      .populate('pharmacy')
      .exec();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException(
        'Your account is pending approval. Please wait for admin to approve your request.',
      );
    }

    if (user.status === UserStatus.REJECTED) {
      throw new UnauthorizedException(
        'Your account has been rejected. Please contact support.',
      );
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact support.',
      );
    }

    if (user.role !== UserRole.ADMIN && user.pharmacy) {
      const pharmacy = user.pharmacy as any;
      if (pharmacy.status !== PharmacyStatus.APPROVED) {
        throw new UnauthorizedException(
          'Your pharmacy is not approved. Please wait for admin approval.',
        );
      }
    }

    return this.generateLoginResponse(user);
  }

  private generateLoginResponse(user: User): LoginResponseDto {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    const access_token = this.jwtService.sign(payload);

    const pharmacy = user.pharmacy as any;
    return {
      access_token,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        pharmacy: pharmacy
          ? {
              id: pharmacy._id?.toString() || pharmacy.toString(),
              name: pharmacy.name,
              status: pharmacy.status,
            }
          : undefined,
      },
    };
  }
}
