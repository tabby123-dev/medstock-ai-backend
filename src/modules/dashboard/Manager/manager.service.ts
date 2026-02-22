import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcrypt';
import { subDays, addDays, format, differenceInDays } from 'date-fns';
import {
  User,
  UserRole,
  UserStatus,
  Medicine,
  MedicineStatus,
  StockMovement,
  MovementType,
  Alert,
  AlertType,
  AlertSeverity,
  AlertStatus,
  Pharmacy,
  PharmacyStatus,
} from '../../schemas';
import {
  CreateStaffDto,
  ApproveMedicineDto,
  RejectMedicineDto,
} from '../../dtos';

@Injectable()
export class ManagerService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Medicine.name) private medicineModel: Model<Medicine>,
    @InjectModel(StockMovement.name)
    private stockMovementModel: Model<StockMovement>,
    @InjectModel(Alert.name) private alertModel: Model<Alert>,
    @InjectModel(Pharmacy.name) private pharmacyModel: Model<Pharmacy>,
  ) {}

  // STAFF MANAGEMENT

  async createStaff(manager: User, dto: CreateStaffDto) {
    const pharmacy = manager.pharmacy as any;
    if (!pharmacy || pharmacy.status !== PharmacyStatus.APPROVED)
      throw new ForbiddenException('Your pharmacy is not approved');

    const exists = await this.userModel.findOne({ email: dto.email }).exec();
    if (exists) throw new ConflictException('Email already exists');

    const password = await bcrypt.hash(dto.password, 10);

    const staff = await new this.userModel({
      email: dto.email,
      password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber,
      role: UserRole.STAFF,
      status: UserStatus.ACTIVE,
      pharmacy: pharmacy._id,
    }).save();

    return this.serializeUser(staff);
  }

  async getStaff(manager: User) {
    const pharmacy = manager.pharmacy as any;
    if (!pharmacy)
      throw new ForbiddenException('No pharmacy associated with your account');

    const staff = await this.userModel
      .find({ pharmacy: pharmacy._id, role: UserRole.STAFF })
      .sort({ createdAt: -1 })
      .exec();

    return staff.map((s) => this.serializeUser(s));
  }

  // MEDICINE APPROVALS

  async getMedicines(manager: User, status?: string) {
    const pharmacy = manager.pharmacy as any;
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

  async approveMedicine(manager: User, id: string, dto: ApproveMedicineDto) {
    const pharmacy = manager.pharmacy as any;
    const medicine = await this.medicineModel
      .findById(id)
      .populate('pharmacy')
      .exec();

    if (!medicine) throw new NotFoundException('Medicine not found');

    if ((medicine.pharmacy as any)._id.toString() !== pharmacy._id.toString())
      throw new ForbiddenException(
        'You can only approve medicines from your pharmacy',
      );

    if (medicine.status !== MedicineStatus.PENDING)
      throw new BadRequestException('Medicine has already been processed');

    medicine.status = MedicineStatus.APPROVED;
    medicine.approvedBy = manager._id as any;
    medicine.approvedAt = new Date();
    await medicine.save();

    const populated = await this.medicineModel
      .findById(id)
      .populate('submittedBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .exec();

    return {
      message: 'Medicine approved successfully',
      medicine: this.serializeMedicine(populated),
    };
  }

  async rejectMedicine(manager: User, id: string, dto: RejectMedicineDto) {
    const pharmacy = manager.pharmacy as any;
    const medicine = await this.medicineModel
      .findById(id)
      .populate('pharmacy')
      .exec();

    if (!medicine) throw new NotFoundException('Medicine not found');

    if ((medicine.pharmacy as any)._id.toString() !== pharmacy._id.toString())
      throw new ForbiddenException(
        'You can only reject medicines from your pharmacy',
      );

    if (medicine.status !== MedicineStatus.PENDING)
      throw new BadRequestException('Medicine has already been processed');

    medicine.status = MedicineStatus.REJECTED;
    medicine.rejectionReason = dto.reason;
    await medicine.save();

    return { message: 'Medicine rejected' };
  }

  // ALERTS

  async getAlerts(manager: User, status?: string, type?: string) {
    const pharmacy = manager.pharmacy as any;
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
      acknowledgedAt: a.acknowledgedAt,
      resolvedAt: a.resolvedAt,
    }));
  }

  // ANALYTICS

  async getFastMovingMedicines(manager: User, limit = 10) {
    const pharmacy = manager.pharmacy as any;
    if (!pharmacy)
      throw new ForbiddenException('No pharmacy associated with your account');

    const thirtyDaysAgo = subDays(new Date(), 30);

    // Get all approved medicine IDs for this pharmacy
    const medicines = await this.medicineModel
      .find({ pharmacy: pharmacy._id, status: MedicineStatus.APPROVED })
      .select('_id')
      .exec();
    const medicineIds = medicines.map((m) => m._id);

    const results = await this.stockMovementModel.aggregate([
      {
        $match: {
          medicine: { $in: medicineIds },
          movementType: MovementType.OUT,
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: '$medicine',
          totalOut: { $sum: '$quantity' },
          movementCount: { $sum: 1 },
          averageOut: { $avg: '$quantity' },
        },
      },
      { $sort: { totalOut: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'medicines',
          localField: '_id',
          foreignField: '_id',
          as: 'medicine',
        },
      },
      { $unwind: '$medicine' },
      {
        $project: {
          _id: 0,
          id: { $toString: '$medicine._id' },
          name: '$medicine.name',
          genericName: '$medicine.genericName',
          currentStock: '$medicine.currentStock',
          unit: '$medicine.unit',
          category: '$medicine.category',
          totalOut: 1,
          movementCount: 1,
          averageOut: { $round: ['$averageOut', 2] },
          velocity: { $literal: 'FAST' },
        },
      },
    ]);

    return results;
  }

  async getSlowMovingMedicines(manager: User, limit = 10) {
    const pharmacy = manager.pharmacy as any;
    if (!pharmacy)
      throw new ForbiddenException('No pharmacy associated with your account');

    const thirtyDaysAgo = subDays(new Date(), 30);

    const medicines = await this.medicineModel
      .find({
        pharmacy: pharmacy._id,
        status: MedicineStatus.APPROVED,
        currentStock: { $gt: 0 },
      })
      .select('_id')
      .exec();
    const medicineIds = medicines.map((m) => m._id);

    // Aggregate outgoing movements
    const movementMap = await this.stockMovementModel.aggregate([
      {
        $match: {
          medicine: { $in: medicineIds },
          movementType: MovementType.OUT,
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: '$medicine',
          totalOut: { $sum: '$quantity' },
          movementCount: { $sum: 1 },
        },
      },
    ]);

    const movementById = new Map(movementMap.map((m) => [m._id.toString(), m]));

    // Find medicines with lowest movement
    const allMedicines = await this.medicineModel
      .find({
        pharmacy: pharmacy._id,
        status: MedicineStatus.APPROVED,
        currentStock: { $gt: 0 },
      })
      .sort({ currentStock: -1 })
      .exec();

    const withMovements = allMedicines
      .map((m) => {
        const mv = movementById.get(m._id.toString()) || {
          totalOut: 0,
          movementCount: 0,
        };
        return {
          id: m._id.toString(),
          name: m.name,
          genericName: m.genericName,
          currentStock: m.currentStock,
          unit: m.unit,
          category: m.category,
          expiryDate: m.expiryDate,
          totalOut: mv.totalOut,
          movementCount: mv.movementCount,
          velocity: 'SLOW',
          daysUntilExpiry: m.expiryDate
            ? differenceInDays(new Date(m.expiryDate), new Date())
            : null,
        };
      })
      .sort((a, b) => a.movementCount - b.movementCount)
      .slice(0, limit);

    return withMovements;
  }

  // FORCASTING

  async getForecast(manager: User, medicineId: string, days: number) {
    const pharmacy = manager.pharmacy as any;

    const medicine = await this.medicineModel
      .findById(medicineId)
      .populate('pharmacy')
      .exec();

    if (!medicine) throw new NotFoundException('Medicine not found');

    if ((medicine.pharmacy as any)._id.toString() !== pharmacy._id.toString())
      throw new ForbiddenException('Medicine does not belong to your pharmacy');

    const historicalStart = subDays(new Date(), 30);

    const movements = await this.stockMovementModel
      .find({
        medicine: medicineId,
        movementType: MovementType.OUT,
        createdAt: { $gte: historicalStart },
      })
      .sort({ createdAt: 1 })
      .exec();

    if (!movements.length) {
      return {
        medicineId: medicine._id.toString(),
        medicineName: medicine.name,
        currentStock: medicine.currentStock,
        forecastDays: days,
        forecast: [],
        message: 'Insufficient historical data for forecasting',
        confidence: 'LOW',
      };
    }

    const dailyDemand = this.buildDailyDemand(movements, 30);
    const avgDailyDemand =
      dailyDemand.reduce((a, b) => a + b, 0) / dailyDemand.length;
    const forecast = this.buildForecast(
      medicine.currentStock,
      avgDailyDemand,
      days,
    );
    const confidence = this.calcConfidence(dailyDemand, avgDailyDemand);

    return {
      medicineId: medicine._id.toString(),
      medicineName: medicine.name,
      currentStock: medicine.currentStock,
      unit: medicine.unit,
      forecastDays: days,
      averageDailyDemand: parseFloat(avgDailyDemand.toFixed(2)),
      forecast,
      confidence,
      historicalDataPoints: movements.length,
      recommendation: this.buildRecommendation(forecast),
    };
  }

  // ─── Background Job ───────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async runAlertGeneration() {
    const pharmacies = await this.pharmacyModel
      .find({ status: PharmacyStatus.APPROVED })
      .exec();

    for (const pharmacy of pharmacies) {
      const medicines = await this.medicineModel
        .find({ pharmacy: pharmacy._id, status: MedicineStatus.APPROVED })
        .exec();

      for (const medicine of medicines) {
        // await this.checkStockAlerts(pharmacy, medicine);
        await this.checkExpiryAlerts(pharmacy, medicine);
      }
    }
  }

  // PRIVATE HELPERS

//   private async checkStockAlerts(pharmacy: Pharmacy, medicine: Medicine) {
//     const stock = medicine.currentStock;

//     if (stock === 0) {
//       return this.upsertAlert({
//         pharmacy: pharmacy._id as any,
//         medicine: medicine._id as any,
//         type: AlertType.OUT_OF_STOCK,
//         severity: AlertSeverity.CRITICAL,
//         message: `${medicine.name} is out of stock`,
//         metadata: { currentStock: stock },
//       });
//     }

//     const thresholds = await this.thresholdModel
//       .find({ medicine: medicine._id, isActive: true })
//       .exec();

//     const min = thresholds.find((t) => t.type === ThresholdType.MINIMUM);
//     if (min && stock <= min.value) {
//       return this.upsertAlert({
//         pharmacy: pharmacy._id as any,
//         medicine: medicine._id as any,
//         type: AlertType.LOW_STOCK,
//         severity: AlertSeverity.HIGH,
//         message: `${medicine.name} is below minimum threshold (${stock}/${min.value})`,
//         metadata: { currentStock: stock, threshold: min.value },
//       });
//     }

//     const reorder = thresholds.find((t) => t.type === ThresholdType.REORDER);
//     if (reorder && stock <= reorder.value) {
//       return this.upsertAlert({
//         pharmacy: pharmacy._id as any,
//         medicine: medicine._id as any,
//         type: AlertType.REORDER_POINT,
//         severity: AlertSeverity.MEDIUM,
//         message: `${medicine.name} reached reorder point (${stock}/${reorder.value})`,
//         metadata: { currentStock: stock, threshold: reorder.value },
//       });
//     }

//     const max = thresholds.find((t) => t.type === ThresholdType.MAXIMUM);
//     if (max && stock >= max.value) {
//       return this.upsertAlert({
//         pharmacy: pharmacy._id as any,
//         medicine: medicine._id as any,
//         type: AlertType.OVERSTOCK,
//         severity: AlertSeverity.LOW,
//         message: `${medicine.name} is overstocked (${stock}/${max.value})`,
//         metadata: { currentStock: stock, threshold: max.value },
//       });
//     }
//   }

  private async checkExpiryAlerts(pharmacy: Pharmacy, medicine: Medicine) {
    if (!medicine.expiryDate) return;

    const daysLeft = differenceInDays(
      new Date(medicine.expiryDate),
      new Date(),
    );

    if (daysLeft < 0) {
      return this.upsertAlert({
        pharmacy: pharmacy._id as any,
        medicine: medicine._id as any,
        type: AlertType.EXPIRED,
        severity: AlertSeverity.CRITICAL,
        message: `${medicine.name} has expired`,
        metadata: {
          expiryDate: medicine.expiryDate,
          daysExpired: Math.abs(daysLeft),
        },
      });
    }

    if (daysLeft <= 30) {
      const severity =
        daysLeft <= 7
          ? AlertSeverity.HIGH
          : daysLeft <= 14
            ? AlertSeverity.MEDIUM
            : AlertSeverity.LOW;

      return this.upsertAlert({
        pharmacy: pharmacy._id as any,
        medicine: medicine._id as any,
        type: AlertType.EXPIRING_SOON,
        severity,
        message: `${medicine.name} expires in ${daysLeft} day(s)`,
        metadata: {
          expiryDate: medicine.expiryDate,
          daysUntilExpiry: daysLeft,
        },
      });
    }
  }

  private async upsertAlert(data: {
    pharmacy: any;
    medicine: any;
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    metadata: any;
  }) {
    const existing = await this.alertModel
      .findOne({
        pharmacy: data.pharmacy,
        medicine: data.medicine,
        type: data.type,
        status: AlertStatus.ACTIVE,
      })
      .exec();

    if (existing) {
      existing.severity = data.severity;
      existing.message = data.message;
      existing.metadata = data.metadata;
      await existing.save();
    } else {
      await new this.alertModel({ ...data, status: AlertStatus.ACTIVE }).save();
    }
  }

  private buildDailyDemand(movements: StockMovement[], days: number): number[] {
    const map: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      map[format(subDays(new Date(), i), 'yyyy-MM-dd')] = 0;
    }
    movements.forEach((mv) => {
      const key = format(new Date(mv.createdAt), 'yyyy-MM-dd');
      if (key in map) map[key] += mv.quantity;
    });
    return Object.values(map);
  }

  private buildForecast(
    currentStock: number,
    avgDailyDemand: number,
    days: number,
  ) {
    let stock = currentStock;
    return Array.from({ length: days }, (_, i) => {
      stock = Math.max(0, stock - avgDailyDemand);
      return {
        date: format(addDays(new Date(), i + 1), 'yyyy-MM-dd'),
        day: i + 1,
        projectedDemand: parseFloat(avgDailyDemand.toFixed(2)),
        projectedStock: parseFloat(stock.toFixed(2)),
        stockoutRisk:
          stock === 0 ? 'HIGH' : stock < avgDailyDemand * 3 ? 'MEDIUM' : 'LOW',
      };
    });
  }

  private calcConfidence(daily: number[], avg: number): string {
    if (daily.length < 7) return 'LOW';
    const variance =
      daily.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / daily.length;
    const cv = avg === 0 ? 0 : Math.sqrt(variance) / avg;
    return cv < 0.3 ? 'HIGH' : cv < 0.6 ? 'MEDIUM' : 'LOW';
  }

  private buildRecommendation(forecast: any[]): string {
    const stockout = forecast.find((f) => f.projectedStock === 0);
    if (!stockout) return 'Stock levels are sufficient for the forecast period';
    if (stockout.day <= 3)
      return `URGENT: Reorder immediately — stockout in ${stockout.day} day(s)`;
    if (stockout.day <= 7)
      return `WARNING: Reorder soon — stockout in ${stockout.day} days`;
    return `Plan to reorder — stockout projected in ${stockout.day} days`;
  }

  private serializeUser(user: User) {
    return {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

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
            id:
              (medicine.submittedBy as any)._id?.toString() ??
              medicine.submittedBy.toString(),
            firstName: (medicine.submittedBy as any).firstName,
            lastName: (medicine.submittedBy as any).lastName,
          }
        : null,
      approvedBy: medicine.approvedBy
        ? {
            id:
              (medicine.approvedBy as any)._id?.toString() ??
              medicine.approvedBy.toString(),
            firstName: (medicine.approvedBy as any).firstName,
            lastName: (medicine.approvedBy as any).lastName,
          }
        : null,
      approvedAt: medicine.approvedAt,
      createdAt: medicine.createdAt,
      updatedAt: medicine.updatedAt,
    };
  }

//   private serializeThreshold(threshold: Threshold) {
//     return {
//       id: threshold._id.toString(),
//       type: threshold.type,
//       value: threshold.value,
//       isActive: threshold.isActive,
//       medicine: threshold.medicine
//         ? {
//             id: (threshold.medicine as any)._id?.toString(),
//             name: (threshold.medicine as any).name,
//             currentStock: (threshold.medicine as any).currentStock,
//           }
//         : null,
//       createdBy: threshold.createdBy
//         ? {
//             id: (threshold.createdBy as any)._id?.toString(),
//             firstName: (threshold.createdBy as any).firstName,
//             lastName: (threshold.createdBy as any).lastName,
//           }
//         : null,
//       createdAt: threshold.createdAt,
//       updatedAt: threshold.updatedAt,
//     };
//   }
}
