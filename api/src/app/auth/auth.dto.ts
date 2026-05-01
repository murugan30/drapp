import { IsString, MinLength } from 'class-validator';

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

export class BootstrapAdminDto {
  @IsString()
  mobile!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  name?: string;

  @IsString()
  email?: string;
}
