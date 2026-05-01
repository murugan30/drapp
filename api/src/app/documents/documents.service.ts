import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';
import { DocumentEntity, DocumentDocument } from './document.schema';
import { CreateDocumentDto } from './documents.dto';

@Injectable()
export class DocumentsService {
  private s3 = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    credentials: process.env.S3_ACCESS_KEY
      ? {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      }
      : undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
  });

  private bucket = process.env.S3_BUCKET || 'clinic-docs';

  private isS3Configured() {
    return !!(
      process.env.S3_ACCESS_KEY ||
      process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_PROFILE ||
      process.env.AWS_WEB_IDENTITY_TOKEN_FILE
    );
  }

  constructor(
    @InjectModel(DocumentEntity.name)
    private docModel: Model<DocumentDocument>,
  ) { }

  async createPresignedUpload(userId: string, dto: CreateDocumentDto, apiBase?: string) {
    const key = `patients/${dto.patientId}/${uuid()}-${dto.fileName}`;
    const document = await this.docModel.create({
      patientId: new Types.ObjectId(dto.patientId),
      uploadedBy: new Types.ObjectId(userId),
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      size: dto.size,
      s3Key: key,
      category: dto.category,
      bucket: this.bucket,
    });

    if (!this.isS3Configured()) {
      if (!apiBase) {
        return { uploadUrl: '', document };
      }
      return {
        uploadUrl: `${apiBase}/documents/local-upload?documentId=${document._id.toString()}`,
        document,
      };
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.mimeType,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 60 * 10,
    });
    return { uploadUrl, document };
  }

  async createPresignedDownload(documentId: string, apiBase?: string) {
    const doc = await this.docModel.findById(documentId);
    if (!doc) {
      return null;
    }

    if (doc.localPath && apiBase) {
      return { downloadUrl: `${apiBase}/documents/local-download?documentId=${doc._id.toString()}`, document: doc };
    }

    const command = new GetObjectCommand({
      Bucket: doc.bucket,
      Key: doc.s3Key,
      ResponseContentDisposition: `attachment; filename="${doc.fileName}"`,
      ResponseContentType: doc.mimeType,
    });
    const downloadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 60 * 10,
    });
    return { downloadUrl, document: doc };
  }

  async createPresignedView(documentId: string, apiBase?: string) {
    const doc = await this.docModel.findById(documentId);
    if (!doc) {
      return null;
    }

    if (doc.localPath && apiBase) {
      return { viewUrl: `${apiBase}/documents/local-view?documentId=${doc._id.toString()}`, document: doc };
    }

    const command = new GetObjectCommand({
      Bucket: doc.bucket,
      Key: doc.s3Key,
      ResponseContentDisposition: 'inline',
      ResponseContentType: doc.mimeType,
    });
    const viewUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 60 * 10,
    });
    return { viewUrl, document: doc };
  }

  async getById(documentId: string) {
    return this.docModel.findById(documentId);
  }

  async listByPatient(patientId: string) {
    return this.docModel
      .find({ patientId: new Types.ObjectId(patientId) })
      .sort({ createdAt: -1 });
  }
}
