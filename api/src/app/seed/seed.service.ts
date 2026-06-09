import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Role } from '../common/roles';
import { UsersService } from '../users/users.service';

@Injectable()
export class SeedService implements OnModuleInit {
  private logger = new Logger(SeedService.name);

  constructor(private usersService: UsersService) {}

  async onModuleInit() {
    const confirm = (process.env.SEED_ADMIN_CONFIRM || '').trim();
    if (confirm !== 'true') {
      return;
    }

    const mobile = (process.env.SEED_ADMIN_MOBILE || '').trim();
    const password = process.env.SEED_ADMIN_PASSWORD || '';
    const name = (process.env.SEED_ADMIN_NAME || '').trim() || undefined;
    const email = (process.env.SEED_ADMIN_EMAIL || '').trim() || undefined;

    if (!mobile || !password) {
      this.logger.warn('Seed admin skipped: missing SEED_ADMIN_MOBILE or SEED_ADMIN_PASSWORD');
      return;
    }

    const alreadyHasAdmin = await this.usersService.hasAnyAdmin();
    if (alreadyHasAdmin) {
      return;
    }

    const existingMobile = await this.usersService.findByMobile(mobile);
    if (existingMobile) {
      this.logger.error('Seed admin failed: mobile already registered. Choose a different SEED_ADMIN_MOBILE.');
      return;
    }

    await this.usersService.createStaff({
      mobile,
      password,
      role: Role.Admin,
      name,
      email,
    });

    this.logger.log(`Seeded first admin user: ${mobile}`);
  }
}
