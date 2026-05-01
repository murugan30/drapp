import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private logger = new Logger(SmsService.name);

  async sendOtp(mobile: string, code: string) {
    const provider = process.env.SMS_PROVIDER || 'log';
    if (provider === 'log') {
      this.logger.warn(`OTP for ${mobile}: ${code}`);
      return;
    }

    // Placeholder for real providers (Twilio, AWS SNS, MSG91, etc.)
    // Implement provider integration here.
    this.logger.error(
      `SMS_PROVIDER=${provider} not configured. Falling back to log only.`,
    );
  }
}
