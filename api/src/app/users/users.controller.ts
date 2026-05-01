import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '../common/roles';
import { UsersService } from './users.service';
import { CreateStaffDto, UpdateUserLocaleDto, UpdateUserProfileDto } from './users.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Roles(Role.Admin)
  @Post()
  createStaff(@Body() dto: CreateStaffDto) {
    return this.usersService.createStaff(dto);
  }

  @Roles(Role.Admin)
  @Get()
  list(@Query('role') role?: Role) {
    return this.usersService.listByRole(role);
  }

  @Roles(Role.Patient, Role.Admin, Role.Assistant)
  @Get('doctors-public')
  listDoctorsPublic() {
    return this.usersService.listDoctorsPublic();
  }

  @Patch('me/locale')
  updateLocale(@Req() req: any, @Body() dto: UpdateUserLocaleDto) {
    return this.usersService.updateLocale(req.user.sub, dto);
  }

  @Patch('me')
  updateProfile(@Req() req: any, @Body() dto: UpdateUserProfileDto) {
    return this.usersService.updateProfile(req.user.sub, dto);
  }
}
