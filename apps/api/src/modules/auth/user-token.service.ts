import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app-exception';
import { generateToken, hashToken } from '../../common/security/crypto';
import { PrismaService } from '../../database/prisma.service';
import { type Prisma, type UserTokenPurpose } from '../../generated/prisma/client';

export const TOKEN_TTL_MS: Record<UserTokenPurpose, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

@Injectable()
export class UserTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Issues a new single-use token and invalidates any outstanding token for the same purpose. */
  async issue(
    userId: string,
    purpose: UserTokenPurpose,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    const token = generateToken();
    const now = new Date();
    await tx.userToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: now },
    });
    await tx.userToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[purpose]),
      },
    });
    return token;
  }

  /**
   * Atomically marks the token used. The conditional updateMany guarantees that two concurrent
   * requests cannot both consume the same token.
   */
  async consume(
    token: string,
    purpose: UserTokenPurpose,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    const tokenHash = hashToken(token);
    const now = new Date();
    const result = await tx.userToken.updateMany({
      where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (result.count !== 1) throw AppException.invalidToken();
    const record = await tx.userToken.findUniqueOrThrow({
      where: { tokenHash },
      select: { userId: true },
    });
    return record.userId;
  }
}
