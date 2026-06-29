import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AppointmentDocument = Appointment & Document;

@Schema({ timestamps: true })
export class Appointment {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  doctorId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  patientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  createdBy!: Types.ObjectId;

  @Prop({ required: true })
  scheduledAt!: Date;

  @Prop({ default: 'scheduled' })
  status!: 'scheduled' | 'cancelled' | 'completed' | 'expired';

  @Prop()
  notes?: string;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
