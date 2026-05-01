import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '../common/roles';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilitySlotDto, SetAvailabilityDto, UpdateAvailabilitySlotDto } from './availability.dto';

@Controller('availability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Roles(Role.Admin, Role.Doctor)
  @Post('me')
  setMine(@Req() req: any, @Body() dto: SetAvailabilityDto) {
    return this.availabilityService.setForDoctor(req.user.sub, dto);
  }

  @Roles(Role.Admin, Role.Doctor)
  @Get('me')
  listMine(@Req() req: any) {
    return this.availabilityService.listForDoctor(req.user.sub);
  }

  @Roles(Role.Admin, Role.Assistant)
  @Get()
  listByDoctor(@Query('doctorId') doctorId: string) {
    return this.availabilityService.listForDoctor(doctorId);
  }

  @Roles(Role.Admin, Role.Doctor)
  @Get('slots/me')
  listMySlots(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.availabilityService.listSlotsForDoctor(req.user.sub, from, to);
  }

  @Roles(Role.Admin, Role.Doctor)
  @Post('slots/me')
  createMySlot(@Req() req: any, @Body() dto: CreateAvailabilitySlotDto) {
    return this.availabilityService.createSlotForDoctor(req.user.sub, dto);
  }

  @Roles(Role.Admin, Role.Doctor)
  @Patch('slots/me/:slotId')
  updateMySlot(@Req() req: any, @Param('slotId') slotId: string, @Body() dto: UpdateAvailabilitySlotDto) {
    return this.availabilityService.updateSlotForDoctor(req.user.sub, slotId, dto);
  }

  @Roles(Role.Admin, Role.Doctor)
  @Delete('slots/me/:slotId')
  deleteMySlot(@Req() req: any, @Param('slotId') slotId: string) {
    return this.availabilityService.deleteSlotForDoctor(req.user.sub, slotId);
  }

  @Roles(Role.Admin, Role.Assistant, Role.Patient)
  @Get('slots')
  listSlotsByDoctor(
    @Query('doctorId') doctorId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.availabilityService.listSlotsForDoctor(doctorId, from, to);
  }
}
