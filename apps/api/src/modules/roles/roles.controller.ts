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
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type RoleDto } from '@saas/contracts';
import { Auth, ReqMeta, RequirePermissions, Tenant, TenantScoped } from '../../common/decorators';
import {
  type AuthContext,
  type RequestMeta,
  type TenantContext,
} from '../../common/http/request-context';
import { CreateRoleDto, UpdateRoleDto } from './roles.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@TenantScoped('roles.read')
@Controller('tenants/:tenantId/roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  list(@Tenant() tenant: TenantContext): Promise<RoleDto[]> {
    return this.roles.list(tenant.tenant.id);
  }

  @Get(':roleId')
  get(
    @Tenant() tenant: TenantContext,
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
  ): Promise<RoleDto> {
    return this.roles.get(tenant.tenant.id, roleId);
  }

  @RequirePermissions('roles.create')
  @Post()
  create(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Body() dto: CreateRoleDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<RoleDto> {
    return this.roles.create(tenant, auth.user.id, dto, meta);
  }

  @RequirePermissions('roles.update')
  @Patch(':roleId')
  update(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @Body() dto: UpdateRoleDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<RoleDto> {
    return this.roles.update(tenant, auth.user.id, roleId, dto, meta);
  }

  @RequirePermissions('roles.delete')
  @Delete(':roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Tenant() tenant: TenantContext,
    @Auth() auth: AuthContext,
    @Param('roleId', new ParseUUIDPipe()) roleId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.roles.remove(tenant, auth.user.id, roleId, meta);
  }
}
