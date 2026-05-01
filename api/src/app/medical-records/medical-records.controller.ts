import { Body, Controller, ForbiddenException, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '../common/roles';
import { MedicalRecordsService } from './medical-records.service';
import { CreateMedicalRecordDto } from './medical-records.dto';
import { PatientsService } from '../patients/patients.service';

@Controller('medical-records')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MedicalRecordsController {
  constructor(
    private medicalRecordsService: MedicalRecordsService,
    private patientsService: PatientsService,
  ) {}

  @Roles(Role.Admin, Role.Doctor, Role.Patient)
  @Post()
  async create(@Req() req: any, @Body() dto: CreateMedicalRecordDto) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }
    if (req.user?.role === Role.Patient) {
      const patient = await this.patientsService.getById(dto.patientId);
      if (patient.ownerUserId?.toString?.() !== userId) {
        throw new ForbiddenException('Not allowed to add medical details for this member');
      }
    }
    return this.medicalRecordsService.create(userId, dto);
  }

  @Roles(Role.Admin, Role.Doctor, Role.Assistant, Role.Patient)
  @Get('by-patient')
  async list(@Req() req: any, @Query('patientId') patientId: string) {
    if (req.user?.role === Role.Patient) {
      const patient = await this.patientsService.getById(patientId);
      if (patient.ownerUserId?.toString?.() !== req.user.sub) {
        throw new ForbiddenException();
      }
    }
    return this.medicalRecordsService.listByPatient(patientId);
  }
}
