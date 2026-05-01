import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PatientDocument = Patient & Document;

@Schema({ timestamps: true })
export class Patient {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  ownerUserId!: Types.ObjectId;

  @Prop({ required: true })
  fullName!: string;

  @Prop()
  dob?: string;

  @Prop()
  gender?: 'male' | 'female' | 'other';

  @Prop()
  relationship?: string;

  @Prop()
  phone?: string;

  @Prop()
  notes?: string;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);
