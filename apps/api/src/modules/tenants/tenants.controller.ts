import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  type MembershipSummaryDto,
  type TenantContextResponse,
  type TenantDto,
  type TenantStatsResponse,
} from '@saas/contracts';
import { Auth, ReqMeta, Tenant, TenantScoped } from '../../common/decorators';
import {
  type AuthContext,
  type RequestMeta,
  type TenantContext,
} from '../../common/http/request-context';
import { toTenantContextResponse, toTenantDto } from './tenant.mapper';
import { CreateTenantDto, UpdateTenantDto } from './tenants.dto';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@ApiCookieAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  /** Workspaces the current user belongs to, including suspended memberships (for display only). */
  @Get()
  listMine(@Auth() auth: AuthContext): Promise<MembershipSummaryDto[]> {
    return this.tenants.listMine(auth.user.id);
  }

  @Post()
  create(
    @Auth() auth: AuthContext,
    @Body() dto: CreateTenantDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<TenantContextResponse> {
    return this.tenants.create(auth, dto, meta);
  }

  /** Effective roles and permissions of the caller in this tenant. Requires only active membership. */
  @TenantScoped()
  @Get(':tenantId/me')
  context(@Tenant() tenant: TenantContext): TenantContextResponse {
    return toTenantContextResponse(tenant);
  }

  @TenantScoped('tenant.read')
  @Get(':tenantId')
  get(@Tenant() tenant: TenantContext): TenantDto {
    return toTenantDto(tenant.tenant);
  }

  @TenantScoped('tenant.update')
  @Patch(':tenantId')
  update(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Body() dto: UpdateTenantDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<TenantDto> {
    return this.tenants.update(tenant, auth.user.id, dto, meta);
  }

  @TenantScoped('tenant.read')
  @Get(':tenantId/stats')
  stats(@Tenant() tenant: TenantContext): Promise<TenantStatsResponse> {
    return this.tenants.stats(tenant.tenant.id);
  }

  @TenantScoped()
  @Post(':tenantId/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.tenants.leave(tenant, auth, meta);
  }
}
