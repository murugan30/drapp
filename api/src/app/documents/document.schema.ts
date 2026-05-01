import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MDocument, Types } from 'mongoose';

export type DocumentDocument = DocumentEntity & MDocument;

@Schema({ timestamps: true })
export class DocumentEntity {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  patientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  uploadedBy!: Types.ObjectId;

  @Prop({ required: true })
  fileName!: string;

  @Prop({ required: true })
  mimeType!: string;

  @Prop({ required: true })
  size!: number;

  @Prop({ required: true })
  s3Key!: string;

  @Prop({ required: true })
  bucket!: string;

  @Prop()
  localPath?: string;

  @Prop()
  category?: string;
}

export const DocumentSchema = SchemaFactory.createForClass(DocumentEntity);
