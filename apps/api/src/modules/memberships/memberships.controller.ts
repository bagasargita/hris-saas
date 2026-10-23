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
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type MemberDto, type Paginated } from '@saas/contracts';
import { Auth, ReqMeta, RequirePermissions, Tenant, TenantScoped } from '../../common/decorators';
import {
  type AuthContext,
  type RequestMeta,
  type TenantContext,
} from '../../common/http/request-context';
import {
  ListMembersQueryDto,
  UpdateMemberRolesDto,
  UpdateMemberStatusDto,
} from './memberships.dto';
import { MembershipsService } from './memberships.service';

@ApiTags('members')
@TenantScoped('members.read')
@Controller('tenants/:tenantId/members')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get()
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: ListMembersQueryDto,
  ): Promise<Paginated<MemberDto>> {
    return this.memberships.list(tenant.tenant.id, query);
  }

  @Get(':memberId')
  get(
    @Tenant() tenant: TenantContext,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ): Promise<MemberDto> {
    return this.memberships.get(tenant.tenant.id, memberId);
  }

  @RequirePermissions('members.update')
  @Put(':memberId/roles')
  updateRoles(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body() dto: UpdateMemberRolesDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<MemberDto> {
    return this.memberships.updateRoles(tenant, auth.user.id, memberId, dto.roleIds, meta);
  }

  @RequirePermissions('members.update')
  @Patch(':memberId')
  updateStatus(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body() dto: UpdateMemberStatusDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<MemberDto> {
    return this.memberships.updateStatus(tenant, auth.user.id, memberId, dto.status, meta);
  }

  @RequirePermissions('members.remove')
  @Delete(':memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.memberships.remove(tenant, auth.user.id, memberId, meta);
  }
}
