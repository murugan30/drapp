import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { PatientsModule } from '../patients/patients.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Otp, OtpSchema } from './otp.schema';
import { JwtStrategy } from './jwt.strategy';
import { SmsService } from './sms.service';

const isProd = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
if (isProd && (!process.env.JWT_SECRET || jwtSecret === 'dev-secret' || jwtSecret === 'change-me')) {
  throw new Error('JWT_SECRET must be set to a strong value in production');
}

const bootstrapSecret = process.env.BOOTSTRAP_ADMIN_SECRET;
if (isProd && (!bootstrapSecret || bootstrapSecret === 'change-me')) {
  throw new Error('BOOTSTRAP_ADMIN_SECRET must be set to a strong value in production');
}

@Module({
  imports: [
    UsersModule,
    PatientsModule,
    PassportModule,
    MongooseModule.forFeature([{ name: Otp.name, schema: OtpSchema }]),
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SmsService],
  exports: [AuthService],
})
export class AuthModule {}
