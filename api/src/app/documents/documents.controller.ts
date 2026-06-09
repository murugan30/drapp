import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '../common/roles';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './documents.dto';
import { PatientsService } from '../patients/patients.service';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

function getUploadLimits(mimeType: string) {
  const mt = (mimeType || '').toLowerCase().trim();
  if (mt === 'application/pdf') {
    return { kind: 'pdf' as const, maxBytes: MAX_PDF_BYTES };
  }
  if (mt.startsWith('image/')) {
    return { kind: 'image' as const, maxBytes: MAX_IMAGE_BYTES };
  }
  return { kind: 'unknown' as const, maxBytes: 0 };
}

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(
    private documentsService: DocumentsService,
    private patientsService: PatientsService,
  ) {}

  @Roles(Role.Admin, Role.Doctor, Role.Assistant, Role.Lab, Role.Patient)
  @Post('upload')
  async createUpload(@Req() req: any, @Body() dto: CreateDocumentDto) {
    const { kind, maxBytes } = getUploadLimits(dto.mimeType);
    if (kind === 'unknown') {
      throw new BadRequestException('Only images and PDF files are allowed.');
    }
    if (!Number.isFinite(dto.size) || dto.size <= 0) {
      throw new BadRequestException('Invalid file size.');
    }
    if (dto.size > maxBytes) {
      const maxMb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
      throw new BadRequestException(`File too large. Max ${maxMb}MB for ${kind.toUpperCase()}.`);
    }

    if (req.user?.role === Role.Patient) {
      const patient = await this.patientsService.getById(dto.patientId);
      if (patient.ownerUserId?.toString?.() !== req.user.sub) {
        throw new ForbiddenException();
      }
    }
    const apiBase = `${req.protocol}://${req.get('host')}/api`;
    return this.documentsService.createPresignedUpload(req.user.sub, dto, apiBase);
  }

  @Roles(Role.Admin)
  @Get('storage/status')
  async storageStatus() {
    return this.documentsService.checkS3BucketAccess();
  }

  @Roles(Role.Admin, Role.Doctor, Role.Assistant, Role.Lab, Role.Patient)
  @Put('local-upload')
  async localUpload(@Req() req: any, @Query('documentId') documentId: string, @Res() res: Response) {
    const doc = await this.documentsService.getById(documentId);
    if (!doc) {
      throw new ForbiddenException();
    }

    const { kind, maxBytes } = getUploadLimits(doc.mimeType);
    if (kind === 'unknown') {
      throw new BadRequestException('Only images and PDF files are allowed.');
    }
    if (!Number.isFinite((doc as any).size) || Number((doc as any).size) <= 0) {
      throw new BadRequestException('Invalid file size.');
    }
    if (Number((doc as any).size) > maxBytes) {
      const maxMb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
      throw new BadRequestException(`File too large. Max ${maxMb}MB for ${kind.toUpperCase()}.`);
    }

    if (req.user?.role === Role.Patient) {
      const patient = await this.patientsService.getById(doc.patientId.toString());
      if (patient.ownerUserId?.toString?.() !== req.user.sub) {
        throw new ForbiddenException();
      }
    }

    let bytes = 0;
    req.on('data', (chunk: any) => {
      bytes += chunk?.length || 0;
      if (bytes > maxBytes) {
        req.destroy(new Error('Upload too large'));
      }
    });

    const uploadRoot = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    await mkdir(uploadRoot, { recursive: true });
    const filePath = join(uploadRoot, `${doc._id.toString()}-${doc.fileName}`);
    await pipeline(req, createWriteStream(filePath));

    await (doc as any).updateOne({ localPath: filePath });
    res.status(200).send('OK');
  }

  @Roles(Role.Admin, Role.Doctor, Role.Assistant, Role.Lab, Role.Patient)
  @Get('download')
  async createDownload(@Req() req: any, @Query('documentId') documentId: string) {
    const doc = await this.documentsService.getById(documentId);
    if (doc && req.user?.role === Role.Patient) {
      const patient = await this.patientsService.getById(doc.patientId.toString());
      if (patient.ownerUserId?.toString?.() !== req.user.sub) {
        throw new ForbiddenException();
      }
    }
    const apiBase = `${req.protocol}://${req.get('host')}/api`;
    return this.documentsService.createPresignedDownload(documentId, apiBase);
  }

  @Roles(Role.Admin, Role.Doctor, Role.Assistant, Role.Lab, Role.Patient)
  @Get('view')
  async createView(@Req() req: any, @Query('documentId') documentId: string) {
    const doc = await this.documentsService.getById(documentId);
    if (doc && req.user?.role === Role.Patient) {
      const patient = await this.patientsService.getById(doc.patientId.toString());
      if (patient.ownerUserId?.toString?.() !== req.user.sub) {
        throw new ForbiddenException();
      }
    }
    const apiBase = `${req.protocol}://${req.get('host')}/api`;
    return this.documentsService.createPresignedView(documentId, apiBase);
  }

  @Roles(Role.Admin, Role.Doctor, Role.Assistant, Role.Lab, Role.Patient)
  @Get('local-download')
  async localDownload(@Req() req: any, @Query('documentId') documentId: string, @Res() res: Response) {
    const doc = await this.documentsService.getById(documentId);
    if (!doc || !(doc as any).localPath) {
      throw new ForbiddenException();
    }
    if (req.user?.role === Role.Patient) {
      const patient = await this.patientsService.getById(doc.patientId.toString());
      if (patient.ownerUserId?.toString?.() !== req.user.sub) {
        throw new ForbiddenException();
      }
    }
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
    return res.sendFile((doc as any).localPath);
  }

  @Roles(Role.Admin, Role.Doctor, Role.Assistant, Role.Lab, Role.Patient)
  @Get('local-view')
  async localView(@Req() req: any, @Query('documentId') documentId: string, @Res() res: Response) {
    const doc = await this.documentsService.getById(documentId);
    if (!doc || !(doc as any).localPath) {
      throw new ForbiddenException();
    }
    if (req.user?.role === Role.Patient) {
      const patient = await this.patientsService.getById(doc.patientId.toString());
      if (patient.ownerUserId?.toString?.() !== req.user.sub) {
        throw new ForbiddenException();
      }
    }
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
    return res.sendFile((doc as any).localPath);
  }

  @Roles(Role.Admin, Role.Doctor, Role.Assistant, Role.Lab, Role.Patient)
  @Get('by-patient')
  async listByPatient(@Req() req: any, @Query('patientId') patientId: string) {
    if (req.user?.role === Role.Patient) {
      const patient = await this.patientsService.getById(patientId);
      if (patient.ownerUserId?.toString?.() !== req.user.sub) {
        throw new ForbiddenException();
      }
    }
    return this.documentsService.listByPatient(patientId);
  }
}
