import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Availability, AvailabilityDocument } from './availability.schema';
import { AvailabilitySlot, AvailabilitySlotDocument } from './availability-slot.schema';
import { CreateAvailabilitySlotDto, SetAvailabilityDto, UpdateAvailabilitySlotDto } from './availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(Availability.name)
    private availabilityModel: Model<AvailabilityDocument>,
    @InjectModel(AvailabilitySlot.name)
    private availabilitySlotModel: Model<AvailabilitySlotDocument>,
  ) {}

  async setForDoctor(doctorId: string, dto: SetAvailabilityDto) {
    return this.availabilityModel.findOneAndUpdate(
      {
        doctorId: new Types.ObjectId(doctorId),
        dayOfWeek: dto.dayOfWeek,
      },
      {
        startTime: dto.startTime,
        endTime: dto.endTime,
        timezone: dto.timezone,
      },
      { upsert: true, new: true },
    );
  }

  async listForDoctor(doctorId: string) {
    return this.availabilityModel
      .find({ doctorId: new Types.ObjectId(doctorId) })
      .sort({ dayOfWeek: 1 });
  }

  async listSlotsForDoctor(doctorId: string, from?: string, to?: string) {
    const query: any = { doctorId: new Types.ObjectId(doctorId) };
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }
    return this.availabilitySlotModel.find(query).sort({ date: 1, startTime: 1 });
  }

  async createSlotForDoctor(doctorId: string, dto: CreateAvailabilitySlotDto) {
    const timezone = dto.timezone || 'Asia/Kolkata';
    const repeatDays = dto.recurring ? dto.repeatDays || 7 : 1;
    const dates = this.expandDates(dto.date, repeatDays);
    const created: AvailabilitySlotDocument[] = [];

    for (const date of dates) {
      await this.assertNoOverlap(doctorId, date, dto.startTime, dto.endTime);
      const doc = await this.availabilitySlotModel.create({
        doctorId: new Types.ObjectId(doctorId),
        date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        timezone,
      });
      created.push(doc);
    }

    return created.length === 1 ? created[0] : created;
  }

  async updateSlotForDoctor(doctorId: string, slotId: string, dto: UpdateAvailabilitySlotDto) {
    const slot = await this.availabilitySlotModel.findById(slotId);
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.doctorId.toString() !== doctorId) throw new NotFoundException('Slot not found');

    const nextDate = dto.date || slot.date;
    const nextStart = dto.startTime || slot.startTime;
    const nextEnd = dto.endTime || slot.endTime;
    await this.assertNoOverlap(doctorId, nextDate, nextStart, nextEnd, slotId);

    if (dto.date) slot.date = dto.date;
    if (dto.startTime) slot.startTime = dto.startTime;
    if (dto.endTime) slot.endTime = dto.endTime;
    if (dto.timezone) slot.timezone = dto.timezone;
    await slot.save();
    return slot;
  }

  async deleteSlotForDoctor(doctorId: string, slotId: string) {
    const slot = await this.availabilitySlotModel.findById(slotId);
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.doctorId.toString() !== doctorId) throw new NotFoundException('Slot not found');
    await slot.deleteOne();
    return { success: true };
  }

  private expandDates(start: string, days: number) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
    if (!match) {
      throw new BadRequestException('Invalid date');
    }
    const [, y, m, day] = match.map(Number);
    const result: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(y, m - 1, day + i);
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      result.push(`${yy}-${mm}-${dd}`);
    }
    return result;
  }

  private toMinutes(time: string) {
    const [h, m] = time.split(':').map((v) => Number(v));
    return h * 60 + m;
  }

  private async assertNoOverlap(
    doctorId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeSlotId?: string,
  ) {
    const start = this.toMinutes(startTime);
    const end = this.toMinutes(endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new BadRequestException('Invalid time range');
    }

    const query: any = { doctorId: new Types.ObjectId(doctorId), date };
    if (excludeSlotId) {
      query._id = { $ne: new Types.ObjectId(excludeSlotId) };
    }

    const existing = await this.availabilitySlotModel.find(query).lean<AvailabilitySlot[]>();
    for (const s of existing) {
      const sStart = this.toMinutes(s.startTime);
      const sEnd = this.toMinutes(s.endTime);
      const overlaps = start < sEnd && end > sStart;
      if (overlaps) {
        throw new BadRequestException('Slot overlaps with an existing slot');
      }
    }
  }
}
