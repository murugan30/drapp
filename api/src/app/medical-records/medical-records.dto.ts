import { IsOptional, IsString } from 'class-validator';

export class CreateMedicalRecordDto {
  @IsString()
  patientId!: string;

  @IsString()
  summary!: string;

  @IsOptional()
  @IsString()
  details?: string;
}
