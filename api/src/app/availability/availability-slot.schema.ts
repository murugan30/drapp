import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AvailabilitySlotDocument = AvailabilitySlot & Document;

@Schema({ timestamps: true })
export class AvailabilitySlot {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  doctorId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  date!: string;

  @Prop({ required: true })
  startTime!: string;

  @Prop({ required: true })
  endTime!: string;

  @Prop({ default: 'Asia/Kolkata' })
  timezone!: string;
}

export const AvailabilitySlotSchema = SchemaFactory.createForClass(AvailabilitySlot);
AvailabilitySlotSchema.index({ doctorId: 1, date: 1 });
