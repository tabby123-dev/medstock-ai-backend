import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  User,
  UserRole,
  UserStatus,
  Pharmacy,
  PharmacyStatus,
  Medicine,
  MedicineStatus,
} from '../../schemas';
import {
  ApprovePharmacyDto,
  RejectPharmacyDto,
  PharmacyManagerRequestDto,
  PharmacyResponseDto,
} from '../../dtos/pharmacy.dto';
import { EmailService } from 'src/common/utils/email.service';
import { randomBytes } from 'crypto';  
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(Pharmacy.name)
    private pharmacyModel: Model<Pharmacy>,
    @InjectModel(Medicine.name)
    private medicineModel: Model<Medicine>,
    private emailService: EmailService,
  ) {}

  async getPharmacyManagerRequests(
    status?: string,
  ): Promise<PharmacyManagerRequestDto[]> {
    const statusFilter = status ? status.toUpperCase() : PharmacyStatus.PENDING;

    const pharmacies = await this.pharmacyModel
      .find({ status: statusFilter })
      .exec();

    const result = [];
    for (const pharmacy of pharmacies) {
      const manager = await this.userModel
        .findOne({
          pharmacy: pharmacy._id,
          role: UserRole.MANAGER,
        })
        .exec();

      if (manager) {
        result.push({
          id: pharmacy._id.toString(),
          pharmacy: this.mapPharmacyToDto(pharmacy),
          manager: {
            id: manager._id.toString(),
            email: manager.email,
            firstName: manager.firstName,
            lastName: manager.lastName,
            phoneNumber: manager.phoneNumber,
            status: manager.status,
          },
          createdAt: pharmacy.createdAt,
        });
      }
    }

    return result;
  }

  async approvePharmacyManagerRequest(
    id: string,
    approveDto: ApprovePharmacyDto,
  ): Promise<{ message: string; pharmacy: PharmacyResponseDto }> {
    const pharmacy = await this.pharmacyModel.findById(id).exec();

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy request not found');
    }

    if (pharmacy.status !== PharmacyStatus.PENDING) {
      throw new BadRequestException('This request has already been processed');
    }

    // Generate a random temporary password
    const temporaryPassword = randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Approve pharmacy
    pharmacy.status = PharmacyStatus.APPROVED;
    await pharmacy.save();

    // Activate manager and set the generated password
    const manager = await this.userModel
      .findOneAndUpdate(
        { pharmacy: pharmacy._id, role: UserRole.MANAGER },
        { status: UserStatus.ACTIVE, password: hashedPassword },
        { new: true },
      )
      .exec();

    if (!manager) {
      throw new NotFoundException('Manager for this pharmacy not found');
    }

    // Send temporary password via email
    await this.emailService.sendManagerApprovalEmail(
      manager.email,
      manager.firstName,
      temporaryPassword,
    );

    return {
      message: 'Pharmacy and manager approved successfully',
      pharmacy: this.mapPharmacyToDto(pharmacy),
    };
  }

  async rejectPharmacyManagerRequest(
    id: string,
    rejectDto: RejectPharmacyDto,
  ): Promise<{ message: string }> {
    const pharmacy = await this.pharmacyModel.findById(id).exec();

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy request not found');
    }

    if (pharmacy.status !== PharmacyStatus.PENDING) {
      throw new BadRequestException('This request has already been processed');
    }

    // Reject pharmacy
    pharmacy.status = PharmacyStatus.REJECTED;
    pharmacy.rejectionReason = rejectDto.reason;
    await pharmacy.save();

    // Reject manager
    await this.userModel
      .updateOne(
        { pharmacy: pharmacy._id, role: UserRole.MANAGER },
        { status: UserStatus.REJECTED },
      )
      .exec();

    return {
      message: 'Pharmacy and manager rejected',
    };
  }

  async getAllUsers(role?: string, status?: string) {
    const query: any = { role: { $ne: UserRole.ADMIN } };

    if (role) {
      query.role = role.toUpperCase();
    }

    if (status) {
      query.status = status.toUpperCase();
    }

    const users = await this.userModel.find(query).populate('pharmacy').exec();

    return users.map((user) => ({
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      status: user.status,
      pharmacy: user.pharmacy
        ? {
            id: (user.pharmacy as any)._id.toString(),
            name: (user.pharmacy as any).name,
            status: (user.pharmacy as any).status,
          }
        : null,
      createdAt: user.createdAt,
    }));
  }

  async getAllPharmacies(status?: string) {
    const query = status ? { status: status.toUpperCase() } : {};

    const pharmacies = await this.pharmacyModel.find(query).exec();
    return pharmacies.map((pharmacy) => this.mapPharmacyToDto(pharmacy));
  }

  async getPharmacyInventory(id: string) {
    const pharmacy = await this.pharmacyModel.findById(id).exec();

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    const medicines = await this.medicineModel
      .find({
        pharmacy: id,
        status: MedicineStatus.APPROVED,
      })
      .populate('submittedBy')
      .populate('approvedBy')
      .exec();

    return medicines.map((medicine) => ({
      id: medicine._id.toString(),
      name: medicine.name,
      genericName: medicine.genericName,
      manufacturer: medicine.manufacturer,
      batchNumber: medicine.batchNumber,
      currentStock: medicine.currentStock,
      unit: medicine.unit,
      unitPrice: medicine.unitPrice,
      expiryDate: medicine.expiryDate,
      category: medicine.category,
      description: medicine.description,
      status: medicine.status,
      submittedBy: {
        id: (medicine.submittedBy as any)._id.toString(),
        firstName: (medicine.submittedBy as any).firstName,
        lastName: (medicine.submittedBy as any).lastName,
      },
      approvedBy: medicine.approvedBy
        ? {
            id: (medicine.approvedBy as any)._id.toString(),
            firstName: (medicine.approvedBy as any).firstName,
            lastName: (medicine.approvedBy as any).lastName,
          }
        : null,
      createdAt: medicine.createdAt,
      updatedAt: medicine.updatedAt,
    }));
  }

  private mapPharmacyToDto(pharmacy: Pharmacy): PharmacyResponseDto {
    return {
      id: pharmacy._id.toString(),
      name: pharmacy.name,
      location: pharmacy.location,
      contactEmail: pharmacy.contactEmail,
      contactPhone: pharmacy.contactPhone,
      status: pharmacy.status,
      rejectionReason: pharmacy.rejectionReason,
      createdAt: pharmacy.createdAt,
      updatedAt: pharmacy.updatedAt,
    };
  }
}
