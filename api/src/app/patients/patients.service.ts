import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { Patient, PatientDocument } from './patient.schema';
import { CreatePatientDto } from './patients.dto';

@Injectable()
export class PatientsService {
  constructor(
    @InjectModel(Patient.name) private patientModel: Model<PatientDocument>,
    private usersService: UsersService,
  ) {}

  async createForOwner(ownerUserId: string, dto: CreatePatientDto) {
    return this.patientModel.create({
      ...dto,
      ownerUserId: new Types.ObjectId(ownerUserId),
    });
  }

  async createForMobile(mobile: string, dto: CreatePatientDto) {
    const user = await this.usersService.createPatientIfMissing(mobile);
    return this.createForOwner(user.id, { ...dto, phone: mobile });
  }

  async listByOwner(ownerUserId: string) {
    return this.patientModel
      .find({ ownerUserId: new Types.ObjectId(ownerUserId) })
      .sort({ createdAt: -1 });
  }

  async listByMobile(mobile: string) {
    return this.patientModel.find({ phone: mobile }).sort({ createdAt: -1 });
  }

  async getById(id: string) {
    const patient = await this.patientModel.findById(id);
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }
    return patient;
  }

  async listPaged(query: string | undefined, page: number, limit: number) {
    const safePage = Math.max(1, Math.floor(page || 1));
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit || 20)));
    const skip = (safePage - 1) * safeLimit;

    const q = (query || '').trim();
    const filter: any = {};
    if (q) {
      filter.$or = [
        { fullName: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.patientModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit),
      this.patientModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }
}
