import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import {
  BootstrapAdminDto,
  LoginDto,
  PasswordResetConfirmDto,
  PasswordResetRequestOtpDto,
  RegisterPatientDto,
  StaffLoginDto,
} from './auth.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { Role } from '../common/roles';

const isProd = process.env.NODE_ENV === 'production';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('staff/login')
  async staffLogin(@Body() dto: StaffLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.staffLogin(dto.mobile, dto.password);
    res.cookie('drapp_token', result.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });
    return result;
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.passwordLogin(dto.mobile, dto.password);
    res.cookie('drapp_token', result.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });
    return result;
  }

  @Post('bootstrap-admin')
  async bootstrapAdmin(
    @Headers('x-bootstrap-secret') secret: string,
    @Body() dto: BootstrapAdminDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const expected = process.env.BOOTSTRAP_ADMIN_SECRET;
    if (!expected) {
      throw new BadRequestException('BOOTSTRAP_ADMIN_SECRET not configured');
    }
    if (!secret || secret !== expected) {
      throw new UnauthorizedException('Invalid bootstrap secret');
    }

    const alreadyHasAdmin = await this.usersService.hasAnyAdmin();
    if (alreadyHasAdmin) {
      throw new BadRequestException('Admin already exists');
    }

    await this.usersService.createStaff({
      mobile: dto.mobile,
      password: dto.password,
      role: Role.Admin,
      name: dto.name,
      email: dto.email,
    });

    const result = await this.authService.staffLogin(dto.mobile, dto.password);
    res.cookie('drapp_token', result.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });
    return result;
  }

  @Post('patient/register')
  async registerPatient(@Body() dto: RegisterPatientDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.registerPatient(dto.mobile, dto.password, {
      fullName: dto.fullName,
      dob: dto.dob,
      gender: dto.gender,
      relationship: dto.relationship,
      phone: dto.phone,
      notes: dto.notes,
    });
    res.cookie('drapp_token', result.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });
    return result;
  }

  @Post('password-reset/request-otp')
  requestPasswordResetOtp(@Body() dto: PasswordResetRequestOtpDto) {
    return this.authService.requestPasswordResetOtp(dto.mobile);
  }

  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    return this.authService.confirmPasswordReset(dto.mobile, dto.code, dto.newPassword);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('drapp_token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
    });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    const user = await this.usersService.findById(req.user.sub);
    return {
      id: user._id.toString(),
      role: user.role,
      mobile: user.mobile,
      preferredLocale: user.preferredLocale,
      name: user.name,
      slotMinutes: typeof user.doctorProfile?.slotMinutes === 'number' ? user.doctorProfile.slotMinutes : 15,
    };
  }
}
