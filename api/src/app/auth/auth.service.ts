import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/user.schema';
import { Otp, OtpDocument } from './otp.schema';
import { Role } from '../common/roles';
import { SmsService } from './sms.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private smsService: SmsService,
    @InjectModel(Otp.name) private otpModel: Model<OtpDocument>,
  ) {}

  async staffLogin(mobile: string, password: string) {
    const user = await this.usersService.findByMobile(mobile, true);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.role === Role.Patient) {
      throw new UnauthorizedException('Use OTP for patient login');
    }
    return this.signToken(user);
  }

  async requestOtp(mobile: string) {
    const user = await this.usersService.createPatientIfMissing(mobile);
    if (user.role !== Role.Patient) {
      throw new BadRequestException('Mobile belongs to staff account');
    }

    const recent = await this.otpModel
      .findOne({ mobile })
      .sort({ createdAt: -1 })
      .lean<{ createdAt?: Date }>();
    if (recent?.createdAt && recent.createdAt.getTime() > Date.now() - 30 * 1000) {
      throw new BadRequestException('Please wait before requesting another OTP');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.otpModel.deleteMany({ mobile });
    await this.otpModel.create({ mobile, codeHash, expiresAt, attempts: 0 });

    await this.smsService.sendOtp(mobile, code);
    const shouldReturnOtp =
      process.env.NODE_ENV !== 'production' || process.env.RETURN_OTP_IN_RESPONSE === 'true';
    if (shouldReturnOtp) {
      return { success: true, otp: code };
    }
    return { success: true };
  }

  async verifyOtp(mobile: string, code: string) {
    const otp = await this.otpModel.findOne({ mobile });
    if (!otp) {
      throw new UnauthorizedException('OTP expired');
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      await this.otpModel.deleteMany({ mobile });
      throw new UnauthorizedException('OTP expired');
    }
    otp.attempts += 1;
    if (otp.attempts > 5) {
      await otp.deleteOne();
      throw new UnauthorizedException('Too many attempts');
    }
    const ok = await bcrypt.compare(code, otp.codeHash);
    if (!ok) {
      await otp.save();
      throw new UnauthorizedException('Invalid OTP');
    }
    await otp.deleteOne();
    const user = await this.usersService.findByMobile(mobile);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.signToken(user);
  }

  private signToken(user: UserDocument) {
    const payload = { sub: user._id.toString(), role: user.role, mobile: user.mobile };
    const slotMinutes = user.doctorProfile?.slotMinutes;
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user._id.toString(),
        role: user.role,
        mobile: user.mobile,
        preferredLocale: user.preferredLocale,
        name: user.name,
        slotMinutes: typeof slotMinutes === 'number' ? slotMinutes : 15,
      },
    };
  }
}
