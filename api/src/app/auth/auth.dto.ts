import { IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  mobile!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class StaffLoginDto {
  @IsString()
  mobile!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class RequestOtpDto {
  @IsString()
  mobile!: string;
}

export class VerifyOtpDto {
  @IsString()
  mobile!: string;

  @IsString()
  code!: string;
}

export class RegisterPatientDto {
  @IsString()
  mobile!: string;

  @IsString()
  @MinLength(6)
  password!: string;

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

export class PasswordResetRequestOtpDto {
  @IsString()
  mobile!: string;
}

export class PasswordResetConfirmDto {
  @IsString()
  mobile!: string;

  @IsString()
  code!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}

export class BootstrapAdminDto {
  @IsString()
  mobile!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;
}
