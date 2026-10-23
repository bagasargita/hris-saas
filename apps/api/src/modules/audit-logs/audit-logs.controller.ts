import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type AuditLogDto, type Paginated } from '@saas/contracts';
import { Tenant, TenantScoped } from '../../common/decorators';
import { type TenantContext } from '../../common/http/request-context';
import { AuditLogQueryDto } from './audit-log.dto';
import { AuditLogService } from './audit-log.service';

@ApiTags('audit-logs')
@TenantScoped('audit_logs.read')
@Controller('tenants/:tenantId/audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogService) {}

  @Get()
  list(
    @Tenant() tenant: TenantContext,
    @Query() query: AuditLogQueryDto,
  ): Promise<Paginated<AuditLogDto>> {
    return this.auditLogs.list({ tenantId: tenant.tenant.id }, query);
  }
}
