import { Controller, Get, Global, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSION_DEFINITIONS, type PermissionDto } from '@saas/contracts';
import { TenantScoped } from '../../common/decorators';
import { AuthorizationService } from './authorization.service';
import { PermissionCatalogSync } from './permission-catalog.sync';

@ApiTags('permissions')
@TenantScoped('roles.read')
@Controller('tenants/:tenantId/permissions')
export class PermissionsController {
  /** The catalog is global; it is exposed per tenant so access follows the same role checks. */
  @Get()
  list(): PermissionDto[] {
    return PERMISSION_DEFINITIONS.map(({ key, group, description }) => ({
      key,
      group,
      description,
    }));
  }
}

@Global()
@Module({
  controllers: [PermissionsController],
  providers: [AuthorizationService, PermissionCatalogSync],
  exports: [AuthorizationService],
})
export class PermissionsModule {}
