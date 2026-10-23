import { HttpStatus, Injectable } from '@nestjs/common';
import { type MeResponse, type TenantContextResponse } from '@saas/contracts';
import { AppException } from '../../common/errors/app-exception';
import { type AuthContext, type RequestMeta } from '../../common/http/request-context';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { AUDIT_ACTIONS, AuditLogService } from '../audit-logs/audit-log.service';
import { MailService } from '../mail/mail.service';
import { AuthorizationService } from '../permissions/authorization.service';
import { toTenantContextResponse } from '../tenants/tenant.mapper';
import { membershipSummaryInclude, toMembershipSummary, toUserDto } from '../users/user.mapper';
import { type LoginDto, type RegisterDto, type ResetPasswordDto } from './auth.dto';
import { PasswordService } from './password.service';
import { type CreatedSession, SessionService } from './session.service';
import { UserTokenService } from './user-token.service';

export interface LoginResult {
  session: CreatedSession;
  me: MeResponse;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly tokens: UserTokenService,
    private readonly mail: MailService,
    private readonly audit: AuditLogService,
    private readonly authorization: AuthorizationService,
  ) {}

  /**
   * Always resolves the same way regardless of whether the email is taken, so the endpoint cannot be
   * used to enumerate accounts. Existing users receive an informational email instead.
   */
  async register(dto: RegisterDto, meta: RequestMeta): Promise<void> {
    if (!this.config.env.registrationEnabled) {
      throw AppException.forbidden('Self-service registration is disabled');
    }
    const passwordHash = await this.passwords.hash(dto.password);
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      await this.mail.sendAccountExists(dto.email);
      return;
    }

    let token: string;
    try {
      token = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: dto.email, name: dto.name, passwordHash },
        });
        await this.audit.record(
          {
            action: AUDIT_ACTIONS.AUTH_REGISTERED,
            actorId: user.id,
            targetType: 'user',
            targetId: user.id,
            meta,
          },
          tx,
        );
        return this.tokens.issue(user.id, 'EMAIL_VERIFICATION', tx);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        await this.mail.sendAccountExists(dto.email);
        return;
      }
      throw error;
    }
    await this.mail.sendEmailVerification(dto.email, dto.name, token);
  }

  async login(
    dto: LoginDto,
    meta: RequestMeta,
    previousSessionId: string | null,
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      await this.passwords.verifyAgainstDummy(dto.password);
      throw this.invalidCredentials();
    }
    const valid = await this.passwords.verify(user.passwordHash, dto.password);
    if (!valid) {
      await this.audit.record({
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        actorId: user.id,
        targetType: 'user',
        targetId: user.id,
        meta,
      });
      throw this.invalidCredentials();
    }
    // Account state is only revealed to someone who proved knowledge of the password.
    if (user.status !== 'ACTIVE') {
      throw new AppException(
        'ACCOUNT_SUSPENDED',
        'This account has been suspended',
        HttpStatus.FORBIDDEN,
      );
    }
    if (!user.emailVerifiedAt) {
      throw new AppException(
        'EMAIL_NOT_VERIFIED',
        'Please verify your email address before signing in',
        HttpStatus.FORBIDDEN,
      );
    }

    if (this.passwords.needsRehash(user.passwordHash)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await this.passwords.hash(dto.password) },
      });
    }

    // Rotate: a login never reuses a pre-existing session identifier.
    if (previousSessionId) await this.sessions.revoke(previousSessionId, user.id);

    const activeTenantId = await this.defaultTenantId(user.id);
    const session = await this.sessions.create(user.id, meta, activeTenantId);
    await this.audit.record({
      action: AUDIT_ACTIONS.AUTH_LOGIN,
      actorId: user.id,
      targetType: 'session',
      targetId: session.id,
      meta,
    });
    return { session, me: await this.me(user.id, activeTenantId) };
  }

  async logout(auth: AuthContext, meta: RequestMeta): Promise<void> {
    await this.sessions.revoke(auth.session.id, auth.user.id);
    await this.audit.record({
      action: AUDIT_ACTIONS.AUTH_LOGOUT,
      actorId: auth.user.id,
      targetType: 'session',
      targetId: auth.session.id,
      meta,
    });
  }

  async me(userId: string, activeTenantId: string | null): Promise<MeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        memberships: { include: membershipSummaryInclude, orderBy: { createdAt: 'asc' } },
      },
    });
    return {
      user: toUserDto(user),
      activeTenantId,
      memberships: user.memberships.map(toMembershipSummary),
    };
  }

  async verifyEmail(token: string, meta: RequestMeta): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const userId = await this.tokens.consume(token, 'EMAIL_VERIFICATION', tx);
      await tx.user.updateMany({
        where: { id: userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      });
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.AUTH_EMAIL_VERIFIED,
          actorId: userId,
          targetType: 'user',
          targetId: userId,
          meta,
        },
        tx,
      );
    });
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerifiedAt || user.status !== 'ACTIVE') return;
    const token = await this.tokens.issue(user.id, 'EMAIL_VERIFICATION');
    await this.mail.sendEmailVerification(user.email, user.name, token);
  }

  async requestPasswordReset(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') return;
    const token = await this.prisma.$transaction(async (tx) => {
      const issued = await this.tokens.issue(user.id, 'PASSWORD_RESET', tx);
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET_REQUESTED,
          actorId: user.id,
          targetType: 'user',
          targetId: user.id,
          meta,
        },
        tx,
      );
      return issued;
    });
    await this.mail.sendPasswordReset(user.email, user.name, token);
  }

  /** Resetting proves control of the mailbox, so it also verifies the email, and it ends every session. */
  async resetPassword(dto: ResetPasswordDto, meta: RequestMeta): Promise<void> {
    const passwordHash = await this.passwords.hash(dto.password);
    await this.prisma.$transaction(async (tx) => {
      const userId = await this.tokens.consume(dto.token, 'PASSWORD_RESET', tx);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.status !== 'ACTIVE') throw AppException.invalidToken();
      const now = new Date();
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          emailVerifiedAt: user.emailVerifiedAt ?? now,
        },
      });
      await this.sessions.revokeAllForUser(userId, {}, tx);
      await this.audit.record(
        {
          action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET,
          actorId: userId,
          targetType: 'user',
          targetId: userId,
          meta,
        },
        tx,
      );
    });
  }

  async switchTenant(auth: AuthContext, tenantId: string): Promise<TenantContextResponse> {
    const context = await this.authorization.resolveTenantContext(auth.user.id, tenantId);
    await this.sessions.setActiveTenant(auth.session.id, tenantId);
    return toTenantContextResponse(context);
  }

  private async defaultTenantId(userId: string): Promise<string | null> {
    const lastSession = await this.prisma.session.findFirst({
      where: { userId, activeTenantId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { activeTenantId: true },
    });
    const accessible = await this.prisma.membership.findMany({
      where: { userId, status: 'ACTIVE', tenant: { status: 'ACTIVE' } },
      orderBy: { createdAt: 'asc' },
      select: { tenantId: true },
    });
    const ids = accessible.map((m) => m.tenantId);
    if (lastSession?.activeTenantId && ids.includes(lastSession.activeTenantId))
      return lastSession.activeTenantId;
    return ids[0] ?? null;
  }

  private invalidCredentials(): AppException {
    return new AppException(
      'INVALID_CREDENTIALS',
      'Invalid email or password',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
