import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type AuditLogDto,
  type Paginated,
  type PlatformTenantDto,
  type PlatformUserDto,
} from '@saas/contracts';
import { Auth, PlatformAdminOnly, ReqMeta } from '../../common/decorators';
import { type AuthContext, type RequestMeta } from '../../common/http/request-context';
import { PlatformAuditLogQueryDto } from '../audit-logs/audit-log.dto';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { PlatformListQueryDto, UpdateStatusDto } from './platform.dto';
import { PlatformService } from './platform.service';

/** Platform administration (SUPER_ADMIN). Grants no access to tenant-scoped endpoints. */
@ApiTags('platform')
@PlatformAdminOnly()
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly auditLogs: AuditLogService,
  ) {}

  @Get('tenants')
  listTenants(@Query() query: PlatformListQueryDto): Promise<Paginated<PlatformTenantDto>> {
    return this.platform.listTenants(query);
  }

  @Patch('tenants/:tenantId')
  setTenantStatus(
    @Auth() auth: AuthContext,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Body() dto: UpdateStatusDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<PlatformTenantDto> {
    return this.platform.setTenantStatus(auth, tenantId, dto, meta);
  }

  @Delete('tenants/:tenantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTenant(
    @Auth() auth: AuthContext,
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.platform.deleteTenant(auth, tenantId, meta);
  }

  @Get('users')
  listUsers(@Query() query: PlatformListQueryDto): Promise<Paginated<PlatformUserDto>> {
    return this.platform.listUsers(query);
  }

  @Patch('users/:userId')
  setUserStatus(
    @Auth() auth: AuthContext,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateStatusDto,
    @ReqMeta() meta: RequestMeta,
  ): Promise<PlatformUserDto> {
    return this.platform.setUserStatus(auth, userId, dto, meta);
  }

  @Get('audit-logs')
  auditLogsList(@Query() query: PlatformAuditLogQueryDto): Promise<Paginated<AuditLogDto>> {
    return this.auditLogs.list({ tenantId: query.tenantId }, query);
  }
}

@Module({
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
