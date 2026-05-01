import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MedicalRecord, MedicalRecordDocument } from './medical-record.schema';
import { CreateMedicalRecordDto } from './medical-records.dto';

@Injectable()
export class MedicalRecordsService {
  constructor(
    @InjectModel(MedicalRecord.name)
    private recordModel: Model<MedicalRecordDocument>,
  ) {}

  async create(userId: string, dto: CreateMedicalRecordDto) {
    return this.recordModel.create({
      patientId: new Types.ObjectId(dto.patientId),
      createdBy: new Types.ObjectId(userId),
      summary: dto.summary,
      details: dto.details,
    });
  }

  async listByPatient(patientId: string) {
    return this.recordModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .sort({ createdAt: -1 });
  }
}
