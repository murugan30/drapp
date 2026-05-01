import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  patientId!: string;

  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsNumber()
  size!: number;

  @IsOptional()
  @IsString()
  category?: string;
}
