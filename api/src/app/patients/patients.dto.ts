import { IsOptional, IsString } from 'class-validator';

export class CreatePatientDto {
  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsOptional()
  @IsString()
  gender?: 'male' | 'female' | 'other';

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePatientByMobileDto extends CreatePatientDto {
  @IsString()
  mobile!: string;
}
