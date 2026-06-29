import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [AppointmentsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
