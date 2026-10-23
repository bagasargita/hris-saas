import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../database/prisma.service';
import { type AuthContext, type RequestMeta } from '../../common/http/request-context';
import { generateToken, hashToken } from '../../common/security/crypto';
import { type Prisma } from '../../generated/prisma/client';

/** Avoid a database write on every request; idle expiry only needs coarse precision. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface CreatedSession {
  id: string;
  token: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async create(
    userId: string,
    meta: RequestMeta,
    activeTenantId: string | null,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<CreatedSession> {
    const token = generateToken();
    const now = Date.now();
    const absoluteExpiresAt = new Date(now + this.config.env.session.absoluteTtlMs);
    const expiresAt = new Date(
      Math.min(now + this.config.env.session.idleTtlMs, absoluteExpiresAt.getTime()),
    );
    const session = await tx.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        activeTenantId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        expiresAt,
        absoluteExpiresAt,
      },
      select: { id: true },
    });
    return { id: session.id, token, expiresAt, absoluteExpiresAt };
  }

  /**
   * Resolves a raw cookie token into an auth context. Returns null for unknown, revoked or expired
   * sessions and for suspended users, so every request re-validates account state.
   */
  async resolve(token: string): Promise<AuthContext | null> {
    if (!token || token.length > 128) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: { select: { id: true, email: true, name: true, platformRole: true, status: true } },
      },
    });
    const now = new Date();
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.absoluteExpiresAt <= now
    ) {
      return null;
    }
    if (session.user.status !== 'ACTIVE') return null;

    if (now.getTime() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      const expiresAt = new Date(
        Math.min(
          now.getTime() + this.config.env.session.idleTtlMs,
          session.absoluteExpiresAt.getTime(),
        ),
      );
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastUsedAt: now, expiresAt },
      });
    }

    const { status: _status, ...user } = session.user;
    return { user, session: { id: session.id, activeTenantId: session.activeTenantId } };
  }

  async revoke(sessionId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  async revokeAllForUser(
    userId: string,
    options: { exceptSessionId?: string } = {},
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await tx.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(options.exceptSessionId ? { id: { not: options.exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async setActiveTenant(sessionId: string, tenantId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { activeTenantId: tenantId },
    });
  }
}
