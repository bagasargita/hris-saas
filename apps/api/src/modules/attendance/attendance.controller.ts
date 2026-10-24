import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type AttendanceCalendarDayDto,
  type AttendanceRecordDto,
  type AttendanceSiteDto,
  type AttendanceTodayDto,
  type BulkWorkScheduleResultDto,
  type Paginated,
  type WorkScheduleDto,
} from '@saas/contracts';
import { Auth, ReqMeta, RequirePermissions, Tenant, TenantScoped } from '../../common/decorators';
import {
  type AuthContext,
  type RequestMeta,
  type TenantContext,
} from '../../common/http/request-context';
import {
  ApproveAttendanceDto,
  AttendanceCalendarQueryDto,
  BulkPutWorkScheduleDto,
  ClockInDto,
  ClockOutDto,
  CreateAttendanceSiteDto,
  ListAttendanceRecordsQueryDto,
  PutWorkScheduleDto,
  UpdateAttendanceSiteDto,
} from './attendance.dto';
import { AttendanceService } from './attendance.service';

@ApiTags('attendance')
@TenantScoped('attendance.read')
@Controller('tenants/:tenantId/attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  // ---- sites

  @Get('sites')
  listSites(@Tenant() tenant: TenantContext): Promise<AttendanceSiteDto[]> {
    return this.attendance.listSites(tenant.tenant.id);
  }

  @RequirePermissions('attendance.sites.manage')
  @Post('sites')
  createSite(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Body() dto: CreateAttendanceSiteDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<AttendanceSiteDto> {
    return this.attendance.createSite(tenant, auth.user.id, dto, meta);
  }

  @RequirePermissions('attendance.sites.manage')
  @Patch('sites/:siteId')
  updateSite(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Param('siteId', new ParseUUIDPipe()) siteId: string,
    @Body() dto: UpdateAttendanceSiteDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<AttendanceSiteDto> {
    return this.attendance.updateSite(tenant, auth.user.id, siteId, dto, meta);
  }

  @RequirePermissions('attendance.sites.manage')
  @Delete('sites/:siteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSite(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Param('siteId', new ParseUUIDPipe()) siteId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.attendance.deleteSite(tenant, auth.user.id, siteId, meta);
  }

  // ---- schedules

  @RequirePermissions('attendance.schedules.manage')
  @Put('schedules')
  putSchedulesBulk(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Body() dto: BulkPutWorkScheduleDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<BulkWorkScheduleResultDto> {
    return this.attendance.putSchedulesBulk(tenant, auth.user.id, dto, meta);
  }

  @Get('schedules/:membershipId')
  getSchedule(
    @Tenant() tenant: TenantContext,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
  ): Promise<WorkScheduleDto> {
    return this.attendance.getSchedule(tenant, membershipId);
  }

  @RequirePermissions('attendance.schedules.manage')
  @Put('schedules/:membershipId')
  putSchedule(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Body() dto: PutWorkScheduleDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<WorkScheduleDto> {
    return this.attendance.putSchedule(tenant, auth.user.id, membershipId, dto, meta);
  }

  // ---- clock

  @Get('me')
  today(@Tenant() tenant: TenantContext): Promise<AttendanceTodayDto> {
    return this.attendance.today(tenant);
  }

  @RequirePermissions('attendance.clock')
  @Post('clock-in')
  clockIn(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Body() dto: ClockInDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<AttendanceRecordDto> {
    return this.attendance.clockIn(tenant, auth.user.id, dto, meta);
  }

  @RequirePermissions('attendance.clock')
  @Post('clock-out')
  clockOut(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Body() dto: ClockOutDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<AttendanceRecordDto> {
    return this.attendance.clockOut(tenant, auth.user.id, dto, meta);
  }

  // ---- records / approve / calendar

  @Get('records')
  listRecords(
    @Tenant() tenant: TenantContext,
    @Query() query: ListAttendanceRecordsQueryDto,
  ): Promise<Paginated<AttendanceRecordDto>> {
    return this.attendance.listRecords(tenant, query);
  }

  @RequirePermissions('attendance.approve')
  @Post('records/:recordId/approve')
  approve(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Param('recordId', new ParseUUIDPipe()) recordId: string,
    @Body() dto: ApproveAttendanceDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<AttendanceRecordDto> {
    return this.attendance.approve(tenant, auth.user.id, recordId, dto, meta);
  }

  @Get('calendar')
  calendar(
    @Tenant() tenant: TenantContext,
    @Query() query: AttendanceCalendarQueryDto,
  ): Promise<AttendanceCalendarDayDto[]> {
    return this.attendance.calendar(tenant, query);
  }
}
