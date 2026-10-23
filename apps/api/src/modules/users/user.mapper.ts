import { type MembershipSummaryDto, type UserDto } from '@saas/contracts';
import { type Prisma, type User } from '../../generated/prisma/client';

/** Explicit allowlist of fields. passwordHash and other internals can never reach a response. */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerifiedAt !== null,
    platformRole: user.platformRole,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

export const membershipSummaryInclude = {
  tenant: { select: { id: true, name: true, slug: true, status: true, plan: true } },
  roles: { select: { role: { select: { id: true, key: true, name: true } } } },
} satisfies Prisma.MembershipInclude;

export type MembershipSummaryRow = Prisma.MembershipGetPayload<{
  include: typeof membershipSummaryInclude;
}>;

export function toMembershipSummary(row: MembershipSummaryRow): MembershipSummaryDto {
  return {
    membershipId: row.id,
    tenant: row.tenant,
    status: row.status,
    roles: row.roles.map(({ role }) => role),
  };
}
