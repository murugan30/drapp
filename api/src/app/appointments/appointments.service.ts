import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Appointment, AppointmentDocument } from './appointment.schema';
import { CreateAppointmentDto } from './appointments.dto';
import { AvailabilitySlot, AvailabilitySlotDocument } from '../availability/availability-slot.schema';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(AvailabilitySlot.name)
    private availabilitySlotModel: Model<AvailabilitySlotDocument>,
  ) {}

  private parseDatePart(isoLike: string) {
    // Expecting YYYY-MM-DD or YYYY-MM-DDTHH:mm...
    const m = /^\d{4}-\d{2}-\d{2}/.exec(isoLike);
    return m ? m[0] : null;
  }

  private parseTimePart(isoLike: string) {
    const m = /T(\d{2}):(\d{2})/.exec(isoLike);
    if (!m) return null;
    return `${m[1]}:${m[2]}`;
  }

  private toMinutes(time: string) {
    const [h, m] = time.split(':').map((v) => Number(v));
    return h * 60 + m;
  }

  private async assertWithinAvailability(doctorId: string, date: string, time: string) {
    const slots = await this.availabilitySlotModel
      .find({ doctorId: new Types.ObjectId(doctorId), date })
      .lean<AvailabilitySlot[]>();
    const t = this.toMinutes(time);
    const ok = slots.some((s) => {
      const start = this.toMinutes(s.startTime);
      const end = this.toMinutes(s.endTime);
      return t >= start && t < end;
    });
    if (!ok) {
      throw new BadRequestException('Selected time is outside doctor availability');
    }
  }

  private async assertNotDoubleBooked(doctorId: string, scheduledAt: Date) {
    const existing = await this.appointmentModel
      .findOne({
        doctorId: new Types.ObjectId(doctorId),
        scheduledAt,
        $or: [
          { status: { $in: ['scheduled', 'completed'] } },
          { status: { $exists: false } },
          { status: null },
        ],
      })
      .lean();
    if (existing) {
      throw new BadRequestException('This time is already booked');
    }
  }

  async create(createdBy: string, dto: CreateAppointmentDto) {
    const date = this.parseDatePart(dto.scheduledAt);
    const time = this.parseTimePart(dto.scheduledAt);
    if (!date || !time) {
      throw new BadRequestException('Invalid scheduledAt');
    }

    await this.assertWithinAvailability(dto.doctorId, date, time);
    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt');
    }
    await this.assertNotDoubleBooked(dto.doctorId, scheduledAt);

    return this.appointmentModel.create({
      doctorId: new Types.ObjectId(dto.doctorId),
      patientId: new Types.ObjectId(dto.patientId),
      createdBy: new Types.ObjectId(createdBy),
      scheduledAt,
      status: 'scheduled',
      notes: dto.notes,
    });
  }

  async listBookedByDoctorAndDate(doctorId: string, date: string) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    return this.appointmentModel
      .find({
        doctorId: new Types.ObjectId(doctorId),
        scheduledAt: { $gte: start, $lt: end },
        $or: [
          { status: { $in: ['scheduled', 'completed'] } },
          { status: { $exists: false } },
          { status: null },
        ],
      })
      .select('scheduledAt')
      .sort({ scheduledAt: 1 });
  }

  async listByDoctorAndDate(doctorId: string, date: string) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    return this.appointmentModel
      .find({
        doctorId: new Types.ObjectId(doctorId),
        scheduledAt: { $gte: start, $lt: end },
      })
      .sort({ scheduledAt: 1 });
  }

  async listByPatient(patientId: string) {
    return this.appointmentModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .sort({ scheduledAt: -1 });
  }

  async getById(id: string) {
    return this.appointmentModel.findById(id);
  }

  async cancelAppointment(appointmentId: string) {
    const appt = await this.appointmentModel.findById(appointmentId);
    if (!appt) {
      throw new BadRequestException('Appointment not found');
    }
    // Backward compatible: older docs might not have status set.
    if (appt.status && appt.status !== 'scheduled') {
      throw new BadRequestException('Only scheduled appointments can be cancelled');
    }
    const diffMs = appt.scheduledAt.getTime() - Date.now();
    if (diffMs <= 0) {
      throw new BadRequestException('Past appointments cannot be cancelled');
    }
    if (diffMs <= 30 * 60 * 1000) {
      throw new BadRequestException('Appointments can only be cancelled more than 30 minutes before the scheduled time');
    }
    appt.status = 'cancelled';
    await appt.save();
    return appt;
  }

  async completeAppointment(appointmentId: string) {
    const appt = await this.appointmentModel.findById(appointmentId);
    if (!appt) {
      throw new BadRequestException('Appointment not found');
    }
    // Backward compatible: older docs might not have status set.
    if (appt.status && appt.status !== 'scheduled') {
      throw new BadRequestException('Only scheduled appointments can be completed');
    }
    appt.status = 'completed';
    await appt.save();
    return appt;
  }

  async markExpiredAppointments(): Promise<number> {
    const now = new Date();
    const result = await this.appointmentModel.updateMany(
      {
        scheduledAt: { $lt: now },
        $or: [
          { status: 'scheduled' },
          { status: { $exists: false } },
          { status: null },
        ],
      },
      { $set: { status: 'expired' } },
    );
    return result.modifiedCount;
  }
}
