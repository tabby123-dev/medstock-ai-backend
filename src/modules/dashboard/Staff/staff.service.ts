import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import {
  User,
  Medicine,
  MedicineStatus,
  StockMovement,
  MovementType,
  Alert,
  AlertStatus,
} from '../../schemas';
import { CreateMedicineDto, CreateStockMovementDto } from '../../dtos';

@Injectable()
export class StaffService {
  constructor(
    @InjectModel(Medicine.name) private medicineModel: Model<Medicine>,
    @InjectModel(StockMovement.name)
    private stockMovementModel: Model<StockMovement>,
    @InjectModel(Alert.name) private alertModel: Model<Alert>,
    @InjectConnection() private connection: Connection,
  ) {}

  // MEDICINE MANAGEMENT

  async submitMedicine(user: User, dto: CreateMedicineDto) {
    const pharmacy = user.pharmacy as any;
    if (!pharmacy)
      throw new ForbiddenException('No pharmacy associated with your account');

    const medicine = await new this.medicineModel({
      ...dto,
      pharmacy: pharmacy._id,
      submittedBy: user._id,
      status: MedicineStatus.PENDING,
    }).save();

    const populated = await this.medicineModel
      .findById(medicine._id)
      .populate('submittedBy', 'firstName lastName')
      .exec();

    return this.serializeMedicine(populated);
  }

  async getMyMedicines(user: User, status?: string) {
    const pharmacy = user.pharmacy as any;
    if (!pharmacy)
      throw new ForbiddenException('No pharmacy associated with your account');

    const filter: any = { pharmacy: pharmacy._id };
    filter.status = status?.toUpperCase() ?? MedicineStatus.APPROVED;

    const medicines = await this.medicineModel
      .find(filter)
      .populate('submittedBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .exec();

    return medicines.map((m) => this.serializeMedicine(m));
  }

  // STOCK MOVEMENTS

  async recordStockMovement(user: User, dto: CreateStockMovementDto) {
    const pharmacy = user.pharmacy as any;
    if (!pharmacy)
      throw new ForbiddenException('No pharmacy associated with your account');

    const medicine = await this.medicineModel
      .findById(dto.medicine_id)
      .populate('pharmacy')
      .exec();

    if (!medicine) throw new NotFoundException('Medicine not found');

    if ((medicine.pharmacy as any)._id.toString() !== pharmacy._id.toString())
      throw new ForbiddenException('Medicine does not belong to your pharmacy');

    if (medicine.status !== MedicineStatus.APPROVED)
      throw new BadRequestException(
        'Stock movements only allowed for approved medicines',
      );

    const currentStock = medicine.currentStock;
    let newStock: number;

    if (dto.movementType === MovementType.IN) {
      newStock = currentStock + dto.quantity;
    } else {
      newStock = currentStock - dto.quantity;
      if (newStock < 0)
        throw new BadRequestException(
          'Insufficient stock. Cannot go below zero.',
        );
    }

    // Use a session for atomic update
    const session = await this.connection.startSession();
    let movement: StockMovement;

    await session.withTransaction(async () => {
      medicine.currentStock = newStock;
      await medicine.save({ session });

      const [saved] = await this.stockMovementModel.create(
        [
          {
            medicine: medicine._id,
            quantity: dto.quantity,
            movementType: dto.movementType,
            reason: dto.reason,
            balanceAfter: newStock,
            notes: dto.notes,
            reference: dto.reference,
            recordedBy: user._id,
          },
        ],
        { session },
      );
      movement = saved;

      // Auto-resolve any active OUT_OF_STOCK or LOW_STOCK alert if stock recovered
      if (dto.movementType === MovementType.IN && newStock > 0) {
        await this.alertModel.updateMany(
          {
            pharmacy: pharmacy._id,
            medicine: medicine._id,
            type: { $in: ['OUT_OF_STOCK', 'LOW_STOCK'] },
            status: AlertStatus.ACTIVE,
          },
          { status: AlertStatus.RESOLVED, resolvedAt: new Date() },
          { session },
        );
      }
    });

    session.endSession();

    const populated = await this.stockMovementModel
      .findById(movement._id)
      .populate('medicine', 'name currentStock unit')
      .populate('recordedBy', 'firstName lastName')
      .exec();

    return this.serializeMovement(populated);
  }

  async getStockMovements(user: User, medicineId?: string) {
    const pharmacy = user.pharmacy as any;
    if (!pharmacy)
      throw new ForbiddenException('No pharmacy associated with your account');

    // Find all medicines in this pharmacy
    const medicineFilter: any = { pharmacy: pharmacy._id };
    if (medicineId) medicineFilter._id = medicineId;

    const medicines = await this.medicineModel
      .find(medicineFilter)
      .select('_id')
      .exec();
    const medicineIds = medicines.map((m) => m._id);

    const movements = await this.stockMovementModel
      .find({ medicine: { $in: medicineIds } })
      .populate('medicine', 'name currentStock unit')
      .populate('recordedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .exec();

    return movements.map((mv) => this.serializeMovement(mv));
  }

  // VIEW ALERTS

  async getAlerts(user: User, status?: string, type?: string) {
    const pharmacy = user.pharmacy as any;
    if (!pharmacy)
      throw new ForbiddenException('No pharmacy associated with your account');

    const filter: any = {
      pharmacy: pharmacy._id,
      status: status?.toUpperCase() ?? AlertStatus.ACTIVE,
    };
    if (type) filter.type = type.toUpperCase();

    const alerts = await this.alertModel
      .find(filter)
      .populate('medicine', 'name currentStock')
      .sort({ severity: -1, createdAt: -1 })
      .exec();

    return alerts.map((a) => ({
      id: a._id.toString(),
      type: a.type,
      severity: a.severity,
      status: a.status,
      message: a.message,
      metadata: a.metadata,
      medicine: a.medicine
        ? {
            id: (a.medicine as any)._id.toString(),
            name: (a.medicine as any).name,
            currentStock: (a.medicine as any).currentStock,
          }
        : null,
      createdAt: a.createdAt,
    }));
  }

  // SERIALIZERS

  private serializeMedicine(medicine: Medicine) {
    return {
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
      rejectionReason: medicine.rejectionReason,
      submittedBy: medicine.submittedBy
        ? {
            id: (medicine.submittedBy as any)._id?.toString(),
            firstName: (medicine.submittedBy as any).firstName,
            lastName: (medicine.submittedBy as any).lastName,
          }
        : null,
      approvedBy: medicine.approvedBy
        ? {
            id: (medicine.approvedBy as any)._id?.toString(),
            firstName: (medicine.approvedBy as any).firstName,
            lastName: (medicine.approvedBy as any).lastName,
          }
        : null,
      approvedAt: medicine.approvedAt,
      createdAt: medicine.createdAt,
      updatedAt: medicine.updatedAt,
    };
  }

  private serializeMovement(movement: StockMovement) {
    return {
      id: movement._id.toString(),
      quantity: movement.quantity,
      movementType: movement.movementType,
      reason: movement.reason,
      balanceAfter: movement.balanceAfter,
      notes: movement.notes,
      reference: movement.reference,
      medicine: movement.medicine
        ? {
            id: (movement.medicine as any)._id.toString(),
            name: (movement.medicine as any).name,
            currentStock: (movement.medicine as any).currentStock,
            unit: (movement.medicine as any).unit,
          }
        : null,
      recordedBy: movement.recordedBy
        ? {
            id: (movement.recordedBy as any)._id.toString(),
            firstName: (movement.recordedBy as any).firstName,
            lastName: (movement.recordedBy as any).lastName,
          }
        : null,
      createdAt: movement.createdAt,
    };
  }
}
