import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { syncPermissionCatalog } from '../tenants/tenant-provisioning';

/** Keeps the Permission table in sync with @saas/contracts on every deploy. Idempotent. */
@Injectable()
export class PermissionCatalogSync implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionCatalogSync.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.prisma.$transaction((tx) => syncPermissionCatalog(tx));
    this.logger.log('Permission catalog synchronized');
  }
}
