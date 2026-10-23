import { HttpStatus, Injectable } from '@nestjs/common';
import { type SessionDto, type UserDto } from '@saas/contracts';
import { AppException } from '../../common/errors/app-exception';
import { type AuthContext, type RequestMeta } from '../../common/http/request-context';
import { PrismaService } from '../../database/prisma.service';
import { AUDIT_ACTIONS, AuditLogService } from '../audit-logs/audit-log.service';
import { PasswordService } from '../auth/password.service';
import { SessionService } from '../auth/session.service';
import { type ChangePasswordDto, type UpdateProfileDto } from './users.dto';
import { toUserDto } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly audit: AuditLogService,
  ) {}

  async updateProfile(
    auth: AuthContext,
    dto: UpdateProfileDto,
    meta: RequestMeta,
  ): Promise<UserDto> {
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: auth.user.id },
        data: { name: dto.name },
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.USER_PROFILE_UPDATED,
          actorId: auth.user.id,
          targetType: 'user',
          targetId: auth.user.id,
          meta,
        },
        tx,
      );
      return updated;
    });
    return toUserDto(user);
  }

  /** Re-authenticates with the current password and signs out every other session. */
  async changePassword(
    auth: AuthContext,
    dto: ChangePasswordDto,
    meta: RequestMeta,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    if (!(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      throw new AppException(
        'INVALID_CREDENTIALS',
        'Current password is incorrect',
        HttpStatus.BAD_REQUEST,
      );
    }
    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
      const revoked = await this.sessions.revokeAllForUser(
        user.id,
        { exceptSessionId: auth.session.id },
        tx,
      );
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.USER_PASSWORD_CHANGED,
          actorId: user.id,
          targetType: 'user',
          targetId: user.id,
          metadata: { revokedSessions: revoked },
          meta,
        },
        tx,
      );
    });
  }

  async listSessions(auth: AuthContext): Promise<SessionDto[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId: auth.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      current: s.id === auth.session.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
    }));
  }

  /** Scoped to the caller's own sessions: another user's session id yields 404. */
  async revokeSession(auth: AuthContext, sessionId: string, meta: RequestMeta): Promise<void> {
    const revoked = await this.sessions.revoke(sessionId, auth.user.id);
    if (!revoked) throw AppException.notFound('Session not found');
    await this.audit.record({
      action: AUDIT_ACTIONS.USER_SESSION_REVOKED,
      actorId: auth.user.id,
      targetType: 'session',
      targetId: sessionId,
      meta,
    });
  }

  async revokeOtherSessions(auth: AuthContext, meta: RequestMeta): Promise<number> {
    const count = await this.sessions.revokeAllForUser(auth.user.id, {
      exceptSessionId: auth.session.id,
    });
    await this.audit.record({
      action: AUDIT_ACTIONS.USER_SESSION_REVOKED,
      actorId: auth.user.id,
      targetType: 'session',
      metadata: { scope: 'others', count },
      meta,
    });
    return count;
  }
}
