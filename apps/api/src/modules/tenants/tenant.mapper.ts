import { type TenantContextResponse, type TenantDto } from '@saas/contracts';
import { type TenantContext } from '../../common/http/request-context';
import { type Tenant } from '../../generated/prisma/client';

export function toTenantDto(
  tenant: Pick<Tenant, 'id' | 'name' | 'slug' | 'status' | 'plan' | 'createdAt'>,
): TenantDto {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    plan: tenant.plan,
    createdAt: tenant.createdAt.toISOString(),
  };
}

export function toTenantContextResponse(context: TenantContext): TenantContextResponse {
  return {
    tenant: toTenantDto(context.tenant),
    membershipId: context.membershipId,
    roles: context.roles,
    permissions: [...context.permissions].sort(),
  };
}
