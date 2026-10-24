import { Injectable } from '@nestjs/common';
import {
  type AttendanceCalendarDayDto,
  type AttendanceRecordDto,
  type AttendanceSiteDto,
  type AttendanceTodayDto,
  type BulkWorkScheduleResultDto,
  type Paginated,
  type WorkScheduleDayDto,
  type WorkScheduleDto,
} from '@saas/contracts';
import { AppException } from '../../common/errors/app-exception';
import { type RequestMeta, type TenantContext } from '../../common/http/request-context';
import { paginated, skipTake } from '../../common/pagination/pagination';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { AUDIT_ACTIONS, AuditLogService } from '../audit-logs/audit-log.service';
import {
  type ApproveAttendanceDto,
  type AttendanceCalendarQueryDto,
  type BulkPutWorkScheduleDto,
  type ClockInDto,
  type ClockOutDto,
  type CreateAttendanceSiteDto,
  type ListAttendanceRecordsQueryDto,
  type PutWorkScheduleDto,
  type UpdateAttendanceSiteDto,
  type WorkScheduleDayInputDto,
} from './attendance.dto';
import {
  isInsideGeofence,
  localMinutes,
  weekdayInTimezone,
  workDateInTimezone,
} from './geofence';

const siteSelect = {
  id: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true,
  radiusMeters: true,
  timezone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AttendanceSiteSelect;

const recordInclude = {
  membership: {
    select: {
      id: true,
      managerId: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
  site: { select: { id: true, name: true } },
  approval: {
    include: {
      approver: {
        select: { id: true, user: { select: { id: true, name: true, email: true } } },
      },
    },
  },
} satisfies Prisma.AttendanceRecordInclude;

type RecordRow = Prisma.AttendanceRecordGetPayload<{ include: typeof recordInclude }>;
type SiteRow = Prisma.AttendanceSiteGetPayload<{ select: typeof siteSelect }>;

function toSiteDto(row: SiteRow): AttendanceSiteDto {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusMeters: row.radiusMeters,
    timezone: row.timezone,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRecordDto(row: RecordRow): AttendanceRecordDto {
  return {
    id: row.id,
    membershipId: row.membershipId,
    member: { id: row.membership.id, user: row.membership.user },
    site: row.site,
    workDate: row.workDate.toISOString().slice(0, 10),
    clockInAt: row.clockInAt.toISOString(),
    clockOutAt: row.clockOutAt?.toISOString() ?? null,
    clockInLat: row.clockInLat,
    clockInLng: row.clockInLng,
    clockOutLat: row.clockOutLat,
    clockOutLng: row.clockOutLng,
    status: row.status,
    note: row.note,
    lateMinutes: row.lateMinutes,
    earlyLeaveMinutes: row.earlyLeaveMinutes,
    approval: row.approval
      ? {
          decision: row.approval.decision,
          comment: row.approval.comment,
          decidedAt: row.approval.decidedAt.toISOString(),
          approver: {
            id: row.approval.approver.id,
            user: row.approval.approver.user,
          },
        }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function parseDateOnly(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw AppException.badRequest(`Invalid ${label}; expected YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw AppException.badRequest(`Invalid ${label}`);
  return date;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /** Org-wide approvers: attendance.approve + members.update (admins/owners). */
  private canApproveOrgWide(context: TenantContext): boolean {
    return (
      context.isOwner ||
      (context.permissions.has('attendance.approve') &&
        context.permissions.has('members.update'))
    );
  }

  private assertCanApproveTarget(
    context: TenantContext,
    targetManagerId: string | null,
  ): void {
    if (!context.permissions.has('attendance.approve')) {
      throw AppException.forbidden('You cannot approve attendance');
    }
    if (this.canApproveOrgWide(context)) return;
    if (targetManagerId !== context.membershipId) {
      throw AppException.forbidden('You can only approve attendance for your direct reports');
    }
  }

  private async membershipIdsInScope(
    context: TenantContext,
    scope: 'self' | 'team' | 'all',
  ): Promise<string[] | 'all'> {
    if (scope === 'self') return [context.membershipId];
    if (scope === 'all') {
      if (!this.canApproveOrgWide(context) && !context.permissions.has('attendance.team.read')) {
        throw AppException.forbidden('You cannot view all attendance records');
      }
      if (!this.canApproveOrgWide(context)) {
        throw AppException.forbidden('Only admins can view all attendance records');
      }
      return 'all';
    }
    // team
    if (
      !context.permissions.has('attendance.team.read') &&
      !context.permissions.has('attendance.approve')
    ) {
      throw AppException.forbidden('You cannot view team attendance');
    }
    const reports = await this.prisma.membership.findMany({
      where: { tenantId: context.tenant.id, managerId: context.membershipId },
      select: { id: true },
    });
    return reports.map((r) => r.id);
  }

  // ---------------------------------------------------------------- sites

  async listSites(tenantId: string, activeOnly = false): Promise<AttendanceSiteDto[]> {
    const rows = await this.prisma.attendanceSite.findMany({
      where: { tenantId, ...(activeOnly ? { isActive: true } : {}) },
      select: siteSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toSiteDto);
  }

  async createSite(
    context: TenantContext,
    actorId: string,
    dto: CreateAttendanceSiteDto,
    meta: RequestMeta,
  ): Promise<AttendanceSiteDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attendanceSite.create({
        data: {
          tenantId: context.tenant.id,
          name: dto.name.trim(),
          address: dto.address?.trim() || null,
          latitude: dto.latitude,
          longitude: dto.longitude,
          radiusMeters: dto.radiusMeters ?? 150,
          timezone: dto.timezone?.trim() || 'UTC',
          isActive: dto.isActive ?? true,
        },
        select: siteSelect,
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.ATTENDANCE_SITE_CREATED,
          actorId,
          tenantId: context.tenant.id,
          targetType: 'attendance_site',
          targetId: created.id,
          metadata: { name: created.name },
          meta,
        },
        tx,
      );
      return created;
    });
    return toSiteDto(row);
  }

  async updateSite(
    context: TenantContext,
    actorId: string,
    siteId: string,
    dto: UpdateAttendanceSiteDto,
    meta: RequestMeta,
  ): Promise<AttendanceSiteDto> {
    const tenantId = context.tenant.id;
    const existing = await this.prisma.attendanceSite.findFirst({
      where: { id: siteId, tenantId },
    });
    if (!existing) throw AppException.notFound('Site not found');

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.attendanceSite.update({
        where: { id: siteId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
          ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
          ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
          ...(dto.radiusMeters !== undefined ? { radiusMeters: dto.radiusMeters } : {}),
          ...(dto.timezone !== undefined ? { timezone: dto.timezone.trim() } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
        select: siteSelect,
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.ATTENDANCE_SITE_UPDATED,
          actorId,
          tenantId,
          targetType: 'attendance_site',
          targetId: siteId,
          metadata: { name: updated.name },
          meta,
        },
        tx,
      );
      return updated;
    });
    return toSiteDto(row);
  }

  async deleteSite(
    context: TenantContext,
    actorId: string,
    siteId: string,
    meta: RequestMeta,
  ): Promise<void> {
    const tenantId = context.tenant.id;
    const existing = await this.prisma.attendanceSite.findFirst({
      where: { id: siteId, tenantId },
    });
    if (!existing) throw AppException.notFound('Site not found');

    const openCount = await this.prisma.attendanceRecord.count({
      where: { siteId, tenantId, status: 'OPEN' },
    });
    if (openCount > 0) {
      throw AppException.conflict('Cannot delete a site with open clock-in records');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.attendanceSite.delete({ where: { id: siteId } });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.ATTENDANCE_SITE_DELETED,
          actorId,
          tenantId,
          targetType: 'attendance_site',
          targetId: siteId,
          metadata: { name: existing.name },
          meta,
        },
        tx,
      );
    });
  }

  // ---------------------------------------------------------------- schedules

  private async assertCanManageSchedule(
    context: TenantContext,
    membershipId: string,
  ): Promise<void> {
    if (!context.permissions.has('attendance.schedules.manage')) {
      throw AppException.forbidden('You cannot manage schedules');
    }
    if (this.canApproveOrgWide(context)) return;
    if (membershipId === context.membershipId) return;
    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, tenantId: context.tenant.id },
      select: { managerId: true },
    });
    if (!target || target.managerId !== context.membershipId) {
      throw AppException.forbidden('You can only manage schedules for yourself or your reports');
    }
  }

  private async assertCanViewSchedule(
    context: TenantContext,
    membershipId: string,
  ): Promise<void> {
    if (membershipId === context.membershipId && context.permissions.has('attendance.read')) {
      return;
    }
    if (context.permissions.has('attendance.schedules.manage')) {
      await this.assertCanManageSchedule(context, membershipId);
      return;
    }
    if (context.permissions.has('attendance.team.read')) {
      if (this.canApproveOrgWide(context)) return;
      const target = await this.prisma.membership.findFirst({
        where: { id: membershipId, tenantId: context.tenant.id },
        select: { managerId: true },
      });
      if (target?.managerId === context.membershipId) return;
    }
    throw AppException.forbidden('You cannot view this schedule');
  }

  async getSchedule(context: TenantContext, membershipId: string): Promise<WorkScheduleDto> {
    const tenantId = context.tenant.id;
    const member = await this.prisma.membership.findFirst({
      where: { id: membershipId, tenantId },
    });
    if (!member) throw AppException.notFound('Member not found');

    await this.assertCanViewSchedule(context, membershipId);

    const days = await this.prisma.workSchedule.findMany({
      where: { tenantId, membershipId },
      include: { site: { select: { id: true, name: true } } },
      orderBy: { weekday: 'asc' },
    });
    return {
      membershipId,
      days: days.map(
        (d): WorkScheduleDayDto => ({
          weekday: d.weekday,
          startMinutes: d.startMinutes,
          endMinutes: d.endMinutes,
          siteId: d.siteId,
          site: d.site,
        }),
      ),
    };
  }

  private async validateScheduleDays(
    tenantId: string,
    days: WorkScheduleDayInputDto[],
  ): Promise<void> {
    const weekdays = new Set<number>();
    for (const day of days) {
      if (weekdays.has(day.weekday)) {
        throw AppException.badRequest('Duplicate weekday in schedule');
      }
      weekdays.add(day.weekday);
      if (day.endMinutes <= day.startMinutes) {
        throw AppException.badRequest('endMinutes must be greater than startMinutes');
      }
      if (day.siteId) {
        const site = await this.prisma.attendanceSite.findFirst({
          where: { id: day.siteId, tenantId, isActive: true },
        });
        if (!site) throw AppException.badRequest('Schedule site not found or inactive');
      }
    }
  }

  async putSchedule(
    context: TenantContext,
    actorId: string,
    membershipId: string,
    dto: PutWorkScheduleDto,
    meta: RequestMeta,
  ): Promise<WorkScheduleDto> {
    await this.assertCanManageSchedule(context, membershipId);
    const tenantId = context.tenant.id;
    const member = await this.prisma.membership.findFirst({
      where: { id: membershipId, tenantId, status: 'ACTIVE' },
    });
    if (!member) throw AppException.notFound('Member not found');

    await this.validateScheduleDays(tenantId, dto.days);

    await this.prisma.$transaction(async (tx) => {
      await tx.workSchedule.deleteMany({ where: { tenantId, membershipId } });
      if (dto.days.length > 0) {
        await tx.workSchedule.createMany({
          data: dto.days.map((d) => ({
            tenantId,
            membershipId,
            weekday: d.weekday,
            startMinutes: d.startMinutes,
            endMinutes: d.endMinutes,
            siteId: d.siteId ?? null,
          })),
        });
      }
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.ATTENDANCE_SCHEDULE_UPDATED,
          actorId,
          tenantId,
          targetType: 'membership',
          targetId: membershipId,
          metadata: { days: dto.days.length },
          meta,
        },
        tx,
      );
    });
    return this.getSchedule(context, membershipId);
  }

  /** Apply one weekly template to many active members the actor may manage. */
  async putSchedulesBulk(
    context: TenantContext,
    actorId: string,
    dto: BulkPutWorkScheduleDto,
    meta: RequestMeta,
  ): Promise<BulkWorkScheduleResultDto> {
    const tenantId = context.tenant.id;
    const uniqueIds = [...new Set(dto.membershipIds)];
    if (uniqueIds.length === 0) {
      throw AppException.badRequest('Select at least one member');
    }

    await this.validateScheduleDays(tenantId, dto.days);

    const members = await this.prisma.membership.findMany({
      where: { tenantId, id: { in: uniqueIds }, status: 'ACTIVE' },
      select: { id: true, managerId: true },
    });
    if (members.length !== uniqueIds.length) {
      throw AppException.badRequest('One or more selected members were not found or are inactive');
    }

    for (const member of members) {
      await this.assertCanManageSchedule(context, member.id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workSchedule.deleteMany({
        where: { tenantId, membershipId: { in: uniqueIds } },
      });
      if (dto.days.length > 0) {
        await tx.workSchedule.createMany({
          data: uniqueIds.flatMap((membershipId) =>
            dto.days.map((d) => ({
              tenantId,
              membershipId,
              weekday: d.weekday,
              startMinutes: d.startMinutes,
              endMinutes: d.endMinutes,
              siteId: d.siteId ?? null,
            })),
          ),
        });
      }
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.ATTENDANCE_SCHEDULE_UPDATED,
          actorId,
          tenantId,
          targetType: 'membership',
          targetId: uniqueIds[0],
          metadata: { membershipIds: uniqueIds, days: dto.days.length, bulk: true },
          meta,
        },
        tx,
      );
    });

    return { updatedMembershipIds: uniqueIds };
  }

  // ---------------------------------------------------------------- clock

  async today(context: TenantContext): Promise<AttendanceTodayDto> {
    const tenantId = context.tenant.id;
    const membershipId = context.membershipId;
    const [open, recent, sites] = await Promise.all([
      this.prisma.attendanceRecord.findFirst({
        where: { tenantId, membershipId, status: 'OPEN' },
        include: recordInclude,
      }),
      this.prisma.attendanceRecord.findMany({
        where: { tenantId, membershipId },
        include: recordInclude,
        orderBy: [{ clockInAt: 'desc' }],
        take: 10,
      }),
      this.listSites(tenantId, true),
    ]);

    let scheduleToday: WorkScheduleDayDto | null = null;
    const now = new Date();
    // Prefer first active site timezone, else UTC.
    const tz = sites[0]?.timezone ?? 'UTC';
    const weekday = weekdayInTimezone(now, tz);
    const day = await this.prisma.workSchedule.findFirst({
      where: { tenantId, membershipId, weekday },
      include: { site: { select: { id: true, name: true } } },
    });
    if (day) {
      scheduleToday = {
        weekday: day.weekday,
        startMinutes: day.startMinutes,
        endMinutes: day.endMinutes,
        siteId: day.siteId,
        site: day.site,
      };
    }

    return {
      openRecord: open ? toRecordDto(open) : null,
      recent: recent.map(toRecordDto),
      sites,
      scheduleToday,
    };
  }

  async clockIn(
    context: TenantContext,
    actorId: string,
    dto: ClockInDto,
    meta: RequestMeta,
  ): Promise<AttendanceRecordDto> {
    const tenantId = context.tenant.id;
    const membershipId = context.membershipId;
    const site = await this.prisma.attendanceSite.findFirst({
      where: { id: dto.siteId, tenantId, isActive: true },
    });
    if (!site) throw AppException.notFound('Site not found or inactive');

    if (!isInsideGeofence(dto.latitude, dto.longitude, site.latitude, site.longitude, site.radiusMeters)) {
      throw AppException.badRequest(
        'You are outside the allowed radius for this site. Move closer and try again.',
      );
    }

    const existingOpen = await this.prisma.attendanceRecord.findFirst({
      where: { tenantId, membershipId, status: 'OPEN' },
    });
    if (existingOpen) {
      throw AppException.conflict('You already have an open clock-in. Clock out first.');
    }

    const now = new Date();
    const workDateStr = workDateInTimezone(now, site.timezone);
    const workDate = parseDateOnly(workDateStr, 'workDate');
    const weekday = weekdayInTimezone(now, site.timezone);
    const schedule = await this.prisma.workSchedule.findFirst({
      where: { tenantId, membershipId, weekday },
    });
    let lateMinutes: number | null = null;
    if (schedule) {
      const mins = localMinutes(now, site.timezone);
      lateMinutes = Math.max(0, mins - schedule.startMinutes);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attendanceRecord.create({
        data: {
          tenantId,
          membershipId,
          siteId: site.id,
          workDate,
          clockInAt: now,
          clockInLat: dto.latitude,
          clockInLng: dto.longitude,
          status: 'OPEN',
          note: dto.note?.trim() || null,
          lateMinutes,
        },
        include: recordInclude,
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.ATTENDANCE_CLOCK_IN,
          actorId,
          tenantId,
          targetType: 'attendance_record',
          targetId: created.id,
          metadata: { siteId: site.id, lateMinutes },
          meta,
        },
        tx,
      );
      return created;
    });
    return toRecordDto(row);
  }

  async clockOut(
    context: TenantContext,
    actorId: string,
    dto: ClockOutDto,
    meta: RequestMeta,
  ): Promise<AttendanceRecordDto> {
    const tenantId = context.tenant.id;
    const membershipId = context.membershipId;
    const open = await this.prisma.attendanceRecord.findFirst({
      where: { tenantId, membershipId, status: 'OPEN' },
      include: { site: true },
    });
    if (!open) throw AppException.conflict('No open clock-in to close');

    if (
      !isInsideGeofence(
        dto.latitude,
        dto.longitude,
        open.site.latitude,
        open.site.longitude,
        open.site.radiusMeters,
      )
    ) {
      throw AppException.badRequest(
        'You are outside the allowed radius for this site. Move closer and try again.',
      );
    }

    const now = new Date();
    const weekday = weekdayInTimezone(now, open.site.timezone);
    const schedule = await this.prisma.workSchedule.findFirst({
      where: { tenantId, membershipId, weekday },
    });
    let earlyLeaveMinutes: number | null = null;
    if (schedule) {
      const mins = localMinutes(now, open.site.timezone);
      earlyLeaveMinutes = Math.max(0, schedule.endMinutes - mins);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.attendanceRecord.update({
        where: { id: open.id },
        data: {
          clockOutAt: now,
          clockOutLat: dto.latitude,
          clockOutLng: dto.longitude,
          status: 'PENDING',
          earlyLeaveMinutes,
          ...(dto.note !== undefined ? { note: dto.note.trim() || null } : {}),
        },
        include: recordInclude,
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.ATTENDANCE_CLOCK_OUT,
          actorId,
          tenantId,
          targetType: 'attendance_record',
          targetId: updated.id,
          metadata: { earlyLeaveMinutes },
          meta,
        },
        tx,
      );
      return updated;
    });
    return toRecordDto(row);
  }

  // ---------------------------------------------------------------- records / approve / calendar

  async listRecords(
    context: TenantContext,
    query: ListAttendanceRecordsQueryDto,
  ): Promise<Paginated<AttendanceRecordDto>> {
    const tenantId = context.tenant.id;
    const scopeIds = await this.membershipIdsInScope(context, query.scope);

    const where: Prisma.AttendanceRecordWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.membershipId ? { membershipId: query.membershipId } : {}),
      ...(scopeIds !== 'all' ? { membershipId: { in: scopeIds } } : {}),
      ...(query.from || query.to
        ? {
            workDate: {
              ...(query.from ? { gte: parseDateOnly(query.from, 'from') } : {}),
              ...(query.to ? { lte: parseDateOnly(query.to, 'to') } : {}),
            },
          }
        : {}),
    };

    // Self-scope without team/approve: force own membership only.
    if (
      query.scope === 'self' &&
      !context.permissions.has('attendance.team.read') &&
      !context.permissions.has('attendance.approve')
    ) {
      where.membershipId = context.membershipId;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.attendanceRecord.findMany({
        where,
        include: recordInclude,
        orderBy: [{ workDate: 'desc' }, { clockInAt: 'desc' }, { id: 'asc' }],
        ...skipTake(query),
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);
    return paginated(rows.map(toRecordDto), total, query);
  }

  async approve(
    context: TenantContext,
    actorId: string,
    recordId: string,
    dto: ApproveAttendanceDto,
    meta: RequestMeta,
  ): Promise<AttendanceRecordDto> {
    const tenantId = context.tenant.id;
    const record = await this.prisma.attendanceRecord.findFirst({
      where: { id: recordId, tenantId },
      include: { membership: { select: { managerId: true } } },
    });
    if (!record) throw AppException.notFound('Attendance record not found');
    if (record.status !== 'PENDING') {
      throw AppException.conflict('Only pending records can be approved or rejected');
    }
    if (record.membershipId === context.membershipId) {
      throw AppException.forbidden('You cannot approve your own attendance');
    }
    this.assertCanApproveTarget(context, record.membership.managerId);

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.attendanceApproval.upsert({
        where: { recordId },
        create: {
          tenantId,
          recordId,
          approverMembershipId: context.membershipId,
          decision: dto.decision,
          comment: dto.comment?.trim() || null,
        },
        update: {
          approverMembershipId: context.membershipId,
          decision: dto.decision,
          comment: dto.comment?.trim() || null,
          decidedAt: new Date(),
        },
      });
      const updated = await tx.attendanceRecord.update({
        where: { id: recordId },
        data: { status: dto.decision },
        include: recordInclude,
      });
      await this.audit.record(
        {
          action:
            dto.decision === 'APPROVED'
              ? AUDIT_ACTIONS.ATTENDANCE_APPROVED
              : AUDIT_ACTIONS.ATTENDANCE_REJECTED,
          actorId,
          tenantId,
          targetType: 'attendance_record',
          targetId: recordId,
          metadata: { decision: dto.decision },
          meta,
        },
        tx,
      );
      return updated;
    });
    return toRecordDto(row);
  }

  async calendar(
    context: TenantContext,
    query: AttendanceCalendarQueryDto,
  ): Promise<AttendanceCalendarDayDto[]> {
    if (!/^\d{4}-\d{2}$/.test(query.month)) {
      throw AppException.badRequest('month must be YYYY-MM');
    }
    const year = Number(query.month.slice(0, 4));
    const month = Number(query.month.slice(5, 7));
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0)); // last day of month

    const scopeIds = await this.membershipIdsInScope(context, query.scope);
    const where: Prisma.AttendanceRecordWhereInput = {
      tenantId: context.tenant.id,
      workDate: { gte: from, lte: to },
      ...(scopeIds !== 'all' ? { membershipId: { in: scopeIds.length ? scopeIds : ['00000000-0000-0000-0000-000000000000'] } } : {}),
    };

    const rows = await this.prisma.attendanceRecord.findMany({
      where,
      include: recordInclude,
      orderBy: [{ workDate: 'asc' }, { clockInAt: 'asc' }],
    });

    const byDate = new Map<string, AttendanceRecordDto[]>();
    for (const row of rows) {
      const key = row.workDate.toISOString().slice(0, 10);
      const list = byDate.get(key) ?? [];
      list.push(toRecordDto(row));
      byDate.set(key, list);
    }
    return [...byDate.entries()].map(([date, records]) => ({ date, records }));
  }
}
