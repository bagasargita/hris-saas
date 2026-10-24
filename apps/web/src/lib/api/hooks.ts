'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AttendanceCalendarDayDto,
  AttendanceRecordDto,
  AttendanceSiteDto,
  AttendanceTodayDto,
  AuditLogDto,
  BillingDto,
  BulkWorkScheduleResultDto,
  InvitationDto,
  InvitationImportResultDto,
  MeResponse,
  MemberDto,
  MembershipSummaryDto,
  Paginated,
  PermissionDto,
  PermissionKey,
  PlatformTenantDto,
  PlatformUserDto,
  RoleDto,
  SessionDto,
  TenantContextResponse,
  TenantDto,
  TenantStatsResponse,
  TenantStatus,
  UserStatus,
  WorkScheduleDto,
} from '@saas/contracts';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client';
import { queryKeys, toSearchParams } from './query-keys';

export interface ListParams {
  page: number;
  limit: number;
  search?: string;
  sortOrder?: 'asc' | 'desc';
}

const tenantPath = (tenantId: string, path = '') =>
  `/tenants/${encodeURIComponent(tenantId)}${path}`;

// ---------------------------------------------------------------- current user

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => apiGet<MeResponse>('/auth/me') });
}

export function useMyTenants() {
  return useQuery({
    queryKey: queryKeys.myTenants,
    queryFn: () => apiGet<MembershipSummaryDto[]>('/tenants'),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<void>('/auth/logout'),
    onSettled: () => {
      // Drop every cached response so nothing from this account survives into the next session.
      queryClient.clear();
    },
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; slug?: string }) =>
      apiPost<TenantContextResponse>('/tenants', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  });
}

export function useSessions() {
  return useQuery({
    queryKey: queryKeys.mySessions,
    queryFn: () => apiGet<SessionDto[]>('/users/me/sessions'),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiDelete(`/users/me/sessions/${encodeURIComponent(sessionId)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mySessions }),
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ revoked: number }>('/users/me/sessions/revoke-others'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mySessions }),
  });
}

// ---------------------------------------------------------------- tenant

export function useTenantStats(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.tenantStats(tenantId),
    queryFn: () => apiGet<TenantStatsResponse>(tenantPath(tenantId, '/stats')),
  });
}

export function useUpdateTenant(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => apiPatch<TenantDto>(tenantPath(tenantId), input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.me }),
      ]),
  });
}

export function useLeaveTenant(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<void>(tenantPath(tenantId, '/leave')),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.tenant(tenantId) });
      return queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

// ---------------------------------------------------------------- members

export interface MemberListParams extends ListParams {
  status?: 'ACTIVE' | 'SUSPENDED';
  roleId?: string;
  sortBy?: 'joinedAt' | 'name' | 'email';
}

export function useMembers(tenantId: string, params: MemberListParams) {
  return useQuery({
    queryKey: queryKeys.members(tenantId, params),
    queryFn: () =>
      apiGet<Paginated<MemberDto>>(
        tenantPath(tenantId, `/members${toSearchParams({ ...params })}`),
      ),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateTenant(tenantId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.tenant(tenantId) });
}

export function useUpdateMemberRoles(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: ({ memberId, roleIds }: { memberId: string; roleIds: string[] }) =>
      apiPut<MemberDto>(tenantPath(tenantId, `/members/${memberId}/roles`), { roleIds }),
    onSuccess: invalidate,
  });
}

export function useUpdateMemberStatus(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: ({ memberId, status }: { memberId: string; status: 'ACTIVE' | 'SUSPENDED' }) =>
      apiPatch<MemberDto>(tenantPath(tenantId, `/members/${memberId}`), { status }),
    onSuccess: invalidate,
  });
}

export function useRemoveMember(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: (memberId: string) => apiDelete(tenantPath(tenantId, `/members/${memberId}`)),
    onSuccess: invalidate,
  });
}

export function useUpdateMemberManager(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: ({ memberId, managerId }: { memberId: string; managerId: string | null }) =>
      apiPatch<MemberDto>(tenantPath(tenantId, `/members/${memberId}/manager`), { managerId }),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------- attendance

export function useAttendanceToday(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.attendanceMe(tenantId),
    queryFn: () => apiGet<AttendanceTodayDto>(tenantPath(tenantId, '/attendance/me')),
    refetchInterval: 30_000,
  });
}

export function useAttendanceSites(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.attendanceSites(tenantId),
    queryFn: () => apiGet<AttendanceSiteDto[]>(tenantPath(tenantId, '/attendance/sites')),
  });
}

export function useCreateAttendanceSite(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: (input: {
      name: string;
      address?: string;
      latitude: number;
      longitude: number;
      radiusMeters?: number;
      timezone?: string;
      isActive?: boolean;
    }) => apiPost<AttendanceSiteDto>(tenantPath(tenantId, '/attendance/sites'), input),
    onSuccess: invalidate,
  });
}

export function useUpdateAttendanceSite(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: ({
      siteId,
      ...input
    }: {
      siteId: string;
      name?: string;
      address?: string | null;
      latitude?: number;
      longitude?: number;
      radiusMeters?: number;
      timezone?: string;
      isActive?: boolean;
    }) => apiPatch<AttendanceSiteDto>(tenantPath(tenantId, `/attendance/sites/${siteId}`), input),
    onSuccess: invalidate,
  });
}

export function useDeleteAttendanceSite(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: (siteId: string) => apiDelete(tenantPath(tenantId, `/attendance/sites/${siteId}`)),
    onSuccess: invalidate,
  });
}

export function useWorkSchedule(tenantId: string, membershipId: string) {
  return useQuery({
    queryKey: queryKeys.attendanceSchedule(tenantId, membershipId),
    queryFn: () =>
      apiGet<WorkScheduleDto>(tenantPath(tenantId, `/attendance/schedules/${membershipId}`)),
    enabled: !!membershipId,
  });
}

export function usePutWorkSchedule(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: ({
      membershipId,
      days,
    }: {
      membershipId: string;
      days: {
        weekday: number;
        startMinutes: number;
        endMinutes: number;
        siteId?: string | null;
      }[];
    }) =>
      apiPut<WorkScheduleDto>(tenantPath(tenantId, `/attendance/schedules/${membershipId}`), {
        days,
      }),
    onSuccess: invalidate,
  });
}

/** Apply one weekly template to many active members. */
export function useBulkPutWorkSchedule(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: ({
      membershipIds,
      days,
    }: {
      membershipIds: string[];
      days: {
        weekday: number;
        startMinutes: number;
        endMinutes: number;
        siteId?: string | null;
      }[];
    }) =>
      apiPut<BulkWorkScheduleResultDto>(tenantPath(tenantId, '/attendance/schedules'), {
        membershipIds,
        days,
      }),
    onSuccess: invalidate,
  });
}

export function useClockIn(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: (input: {
      siteId: string;
      latitude: number;
      longitude: number;
      note?: string;
    }) => apiPost<AttendanceRecordDto>(tenantPath(tenantId, '/attendance/clock-in'), input),
    onSuccess: invalidate,
  });
}

export function useClockOut(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: (input: { latitude: number; longitude: number; note?: string }) =>
      apiPost<AttendanceRecordDto>(tenantPath(tenantId, '/attendance/clock-out'), input),
    onSuccess: invalidate,
  });
}

export interface AttendanceRecordListParams extends ListParams {
  status?: 'OPEN' | 'PENDING' | 'APPROVED' | 'REJECTED';
  scope?: 'self' | 'team' | 'all';
  from?: string;
  to?: string;
  membershipId?: string;
}

export function useAttendanceRecords(tenantId: string, params: AttendanceRecordListParams) {
  return useQuery({
    queryKey: queryKeys.attendanceRecords(tenantId, params),
    queryFn: () =>
      apiGet<Paginated<AttendanceRecordDto>>(
        tenantPath(tenantId, `/attendance/records${toSearchParams({ ...params })}`),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useApproveAttendance(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: ({
      recordId,
      decision,
      comment,
    }: {
      recordId: string;
      decision: 'APPROVED' | 'REJECTED';
      comment?: string;
    }) =>
      apiPost<AttendanceRecordDto>(
        tenantPath(tenantId, `/attendance/records/${recordId}/approve`),
        { decision, comment },
      ),
    onSuccess: invalidate,
  });
}

export function useAttendanceCalendar(
  tenantId: string,
  params: { month: string; scope?: 'self' | 'team' | 'all' },
) {
  return useQuery({
    queryKey: queryKeys.attendanceCalendar(tenantId, params),
    queryFn: () =>
      apiGet<AttendanceCalendarDayDto[]>(
        tenantPath(tenantId, `/attendance/calendar${toSearchParams({ ...params })}`),
      ),
  });
}

// ---------------------------------------------------------------- roles & permissions

export function useRoles(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.roles(tenantId),
    queryFn: () => apiGet<RoleDto[]>(tenantPath(tenantId, '/roles')),
  });
}

export function usePermissionCatalog(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.permissions(tenantId),
    queryFn: () => apiGet<PermissionDto[]>(tenantPath(tenantId, '/permissions')),
    staleTime: 5 * 60_000,
  });
}

export interface RoleInput {
  name: string;
  description?: string;
  permissions: PermissionKey[];
}

export function useCreateRole(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: (input: RoleInput) => apiPost<RoleDto>(tenantPath(tenantId, '/roles'), input),
    onSuccess: invalidate,
  });
}

export function useUpdateRole(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: ({ roleId, ...input }: Partial<RoleInput> & { roleId: string }) =>
      apiPatch<RoleDto>(tenantPath(tenantId, `/roles/${roleId}`), input),
    onSuccess: invalidate,
  });
}

export function useDeleteRole(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: (roleId: string) => apiDelete(tenantPath(tenantId, `/roles/${roleId}`)),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------- invitations

export interface InvitationListParams extends ListParams {
  status?: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
}

export function useInvitations(tenantId: string, params: InvitationListParams) {
  return useQuery({
    queryKey: queryKeys.invitations(tenantId, params),
    queryFn: () =>
      apiGet<Paginated<InvitationDto>>(
        tenantPath(tenantId, `/invitations${toSearchParams({ ...params, search: undefined })}`),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useCreateInvitation(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: (input: { email: string; roleId: string }) =>
      apiPost<InvitationDto>(tenantPath(tenantId, '/invitations'), input),
    onSuccess: invalidate,
  });
}

export function useImportInvitations(tenantId: string) {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('file', file);
      return apiPost<InvitationImportResultDto>(tenantPath(tenantId, '/invitations/import'), body);
    },
    onSuccess: invalidate,
  });
}

/** Downloads the server-issued CSV template for bulk member invitations. */
export async function downloadInvitationImportTemplate(tenantId: string): Promise<void> {
  const blob = await apiGet<Blob>(tenantPath(tenantId, '/invitations/import-template'), {
    responseType: 'blob',
    headers: { Accept: 'text/csv' },
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'member-invitations-template.csv';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function useInvitationAction(tenantId: string, action: 'revoke' | 'resend') {
  const invalidate = useInvalidateTenant(tenantId);
  return useMutation({
    mutationFn: (invitationId: string) =>
      apiPost<InvitationDto>(tenantPath(tenantId, `/invitations/${invitationId}/${action}`)),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------- audit & billing

export interface AuditListParams extends ListParams {
  action?: string;
}

export function useAuditLogs(tenantId: string, params: AuditListParams) {
  return useQuery({
    queryKey: queryKeys.auditLogs(tenantId, params),
    queryFn: () =>
      apiGet<Paginated<AuditLogDto>>(
        tenantPath(tenantId, `/audit-logs${toSearchParams({ ...params, search: undefined })}`),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useBilling(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.billing(tenantId),
    queryFn: () => apiGet<BillingDto>(tenantPath(tenantId, '/billing')),
  });
}

// ---------------------------------------------------------------- platform

export function usePlatformTenants(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.platformTenants(params),
    queryFn: () =>
      apiGet<Paginated<PlatformTenantDto>>(`/platform/tenants${toSearchParams({ ...params })}`),
    placeholderData: keepPreviousData,
  });
}

export function usePlatformUsers(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.platformUsers(params),
    queryFn: () =>
      apiGet<Paginated<PlatformUserDto>>(`/platform/users${toSearchParams({ ...params })}`),
    placeholderData: keepPreviousData,
  });
}

export function usePlatformAuditLogs(params: AuditListParams) {
  return useQuery({
    queryKey: queryKeys.platformAuditLogs(params),
    queryFn: () =>
      apiGet<Paginated<AuditLogDto>>(
        `/platform/audit-logs${toSearchParams({ ...params, search: undefined })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useSetPlatformTenantStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, status }: { tenantId: string; status: TenantStatus }) =>
      apiPatch<PlatformTenantDto>(`/platform/tenants/${tenantId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform'] }),
  });
}

export function useDeletePlatformTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: string) => apiDelete(`/platform/tenants/${tenantId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform'] }),
  });
}

export function useSetPlatformUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: UserStatus }) =>
      apiPatch<PlatformUserDto>(`/platform/users/${userId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform'] }),
  });
}
