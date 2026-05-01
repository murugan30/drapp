import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '../common/roles';
import { PatientsService } from './patients.service';
import { CreatePatientByMobileDto, CreatePatientDto } from './patients.dto';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @Roles(Role.Admin, Role.Doctor, Role.Assistant, Role.Lab)
  @Get()
  listPaged(
    @Query('q') q?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const page = Number(pageRaw || 1);
    const limit = Number(limitRaw || 20);
    return this.patientsService.listPaged(q, page, limit);
  }

  @Roles(Role.Patient)
  @Post()
  createForSelf(@Req() req: any, @Body() dto: CreatePatientDto) {
    return this.patientsService.createForOwner(req.user.sub, dto);
  }

  @Roles(Role.Admin, Role.Doctor, Role.Assistant, Role.Lab)
  @Post('by-mobile')
  createForMobile(@Body() body: CreatePatientByMobileDto) {
    return this.patientsService.createForMobile(body.mobile, body);
  }

  @Roles(Role.Admin, Role.Doctor, Role.Assistant, Role.Lab)
  @Get('by-mobile')
  listByMobile(@Query('mobile') mobile: string) {
    return this.patientsService.listByMobile(mobile);
  }

  @Roles(Role.Patient)
  @Get('my')
  listMine(@Req() req: any) {
    return this.patientsService.listByOwner(req.user.sub);
  }

  @Roles(Role.Admin, Role.Doctor, Role.Assistant, Role.Lab, Role.Patient)
  @Get(':id')
  async getById(@Req() req: any, @Param('id') id: string) {
    const patient = await this.patientsService.getById(id);
    if (req.user?.role === Role.Patient) {
      if (patient.ownerUserId?.toString?.() !== req.user.sub) {
        throw new ForbiddenException();
      }
    }
    return patient;
  }
}
