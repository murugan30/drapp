import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppointmentsService } from '../appointments/appointments.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredAppointments() {
    this.logger.log('Running nightly expired-appointments job...');
    try {
      const count = await this.appointmentsService.markExpiredAppointments();
      this.logger.log(`Marked ${count} appointment(s) as expired.`);
    } catch (err) {
      this.logger.error('Failed to mark expired appointments', err);
    }
  }
}
