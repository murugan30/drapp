import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '../common/roles';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './appointments.dto';
import { PatientsService } from '../patients/patients.service';

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(
    private appointmentsService: AppointmentsService,
    private patientsService: PatientsService,
  ) {}

  @Roles(Role.Admin, Role.Assistant, Role.Patient)
  @Post()
  async create(@Req() req: any, @Body() dto: CreateAppointmentDto) {
    if (req.user?.role === Role.Patient) {
      const patient = await this.patientsService.getById(dto.patientId);
      if (patient.ownerUserId?.toString?.() !== req.user.sub) {
        throw new ForbiddenException();
      }
    }
    return this.appointmentsService.create(req.user.sub, dto);
  }

  @Roles(Role.Admin, Role.Assistant, Role.Patient, Role.Doctor)
  @Patch(':id/cancel')
  async cancel(@Req() req: any, @Param('id') id: string) {
    if (req.user?.role === Role.Patient) {
      // Ensure the appointment belongs to one of this user's members.
      // We do this by checking ownership of the patientId.
      const appt: any = await this.appointmentsService.getById(id);
      if (!appt) throw new ForbiddenException();
      const patient = await this.patientsService.getById(appt.patientId.toString());
      if (patient.ownerUserId?.toString?.() !== req.user.sub) {
        throw new ForbiddenException();
      }
    }
    if (req.user?.role === Role.Doctor) {
      const appt: any = await this.appointmentsService.getById(id);
      if (!appt) throw new ForbiddenException();
      if (appt.doctorId?.toString?.() !== req.user.sub) {
        throw new ForbiddenException();
      }
    }
    return this.appointmentsService.cancelAppointment(id);
  }

  @Roles(Role.Admin, Role.Doctor)
  @Patch(':id/complete')
  async complete(@Req() req: any, @Param('id') id: string) {
    if (req.user?.role === Role.Doctor) {
      const appt: any = await this.appointmentsService.getById(id);
      if (!appt) throw new ForbiddenException();
      if (appt.doctorId?.toString?.() !== req.user.sub) {
        throw new ForbiddenException();
      }
    }
    return this.appointmentsService.completeAppointment(id);
  }

  @Roles(Role.Admin, Role.Assistant, Role.Patient)
  @Get('booked')
  listBooked(@Query('doctorId') doctorId: string, @Query('date') date: string) {
    return this.appointmentsService.listBookedByDoctorAndDate(doctorId, date);
  }

  @Roles(Role.Admin, Role.Doctor, Role.Assistant, Role.Lab)
  @Get('by-doctor')
  listByDoctor(@Req() req: any, @Query('doctorId') doctorId: string, @Query('date') date: string) {
    if (req.user?.role === Role.Doctor && doctorId !== req.user.sub) {
      throw new ForbiddenException();
    }
    return this.appointmentsService.listByDoctorAndDate(doctorId, date);
  }

  @Roles(Role.Admin, Role.Doctor, Role.Assistant, Role.Patient)
  @Get('by-patient')
  async listByPatient(@Req() req: any, @Query('patientId') patientId: string) {
    if (req.user?.role === Role.Patient) {
      const patient = await this.patientsService.getById(patientId);
      if (patient.ownerUserId?.toString?.() !== req.user.sub) {
        throw new ForbiddenException();
      }
    }
    return this.appointmentsService.listByPatient(patientId);
  }

  @Roles(Role.Admin, Role.Doctor)
  @Get(':id')
  async getById(@Req() req: any, @Param('id') id: string) {
    const appt: any = await this.appointmentsService.getById(id);
    if (!appt) throw new ForbiddenException();
    if (req.user?.role === Role.Doctor && appt.doctorId?.toString?.() !== req.user.sub) {
      throw new ForbiddenException();
    }
    return appt;
  }
}
