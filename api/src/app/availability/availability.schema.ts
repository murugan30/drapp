import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AvailabilityDocument = Availability & Document;

@Schema({ timestamps: true })
export class Availability {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  doctorId!: Types.ObjectId;

  @Prop({ required: true })
  dayOfWeek!: number;

  @Prop({ required: true })
  startTime!: string;

  @Prop({ required: true })
  endTime!: string;

  @Prop({ default: 'Asia/Kolkata' })
  timezone!: string;
}

export const AvailabilitySchema = SchemaFactory.createForClass(Availability);
