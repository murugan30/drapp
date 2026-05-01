import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../common/roles';

export class CreateStaffDto {
  @IsString()
  mobile!: string;

  @IsEnum(Role)
  role!: Role;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateUserLocaleDto {
  @IsString()
  preferredLocale!: 'en' | 'ta';
}

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  doctorProfile?: {
    specialty?: string;
    qualification?: string;
    experienceYears?: number;
  };
}
