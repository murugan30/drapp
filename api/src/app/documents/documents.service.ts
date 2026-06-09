import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';
import { DocumentEntity, DocumentDocument } from './document.schema';
import { CreateDocumentDto } from './documents.dto';

@Injectable()
export class DocumentsService {
  private region = (process.env.S3_REGION || 'us-east-1').trim();
  private endpoint = (process.env.S3_ENDPOINT || '').trim() || undefined;
  private forcePathStyle = !!this.endpoint;

  private s3 = new S3Client({
    region: this.region,
    endpoint: this.endpoint,
    credentials: (process.env.S3_ACCESS_KEY || '').trim()
      ? {
        accessKeyId: (process.env.S3_ACCESS_KEY || '').trim(),
        secretAccessKey: (process.env.S3_SECRET_KEY || '').trim(),
      }
      : undefined,
    forcePathStyle: this.forcePathStyle,
  });

  private bucket = (process.env.S3_BUCKET || 'clinic-docs').trim();

  private isS3Configured() {
    return !!(
      (process.env.S3_ACCESS_KEY || '').trim() ||
      process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_PROFILE ||
      process.env.AWS_WEB_IDENTITY_TOKEN_FILE
    );
  }

  getStorageStatus() {
    return {
      mode: this.isS3Configured() ? ('s3' as const) : ('local' as const),
      bucket: this.bucket,
      region: this.region,
      endpoint: this.endpoint || null,
      forcePathStyle: this.forcePathStyle,
    };
  }

  async checkS3BucketAccess() {
    const status = this.getStorageStatus();
    if (status.mode !== 's3') {
      return { ok: false as const, status, error: 'S3 is not configured' };
    }
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { ok: true as const, status };
    } catch (e: any) {
      return { ok: false as const, status, error: e?.name || e?.message || 'S3 bucket check failed' };
    }
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
