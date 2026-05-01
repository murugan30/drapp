import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../common/roles';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  mobile!: string;

  @Prop({ type: String, required: true, enum: Role })
  role!: Role;

  @Prop({ select: false })
  passwordHash?: string;

  @Prop({ type: String, default: 'en', enum: ['en', 'ta'] })
  preferredLocale!: 'en' | 'ta';

  @Prop()
  name?: string;

  @Prop()
  email?: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: Object })
  doctorProfile?: {
    specialty?: string;
    qualification?: string;
    experienceYears?: number;
    slotMinutes?: number;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);
