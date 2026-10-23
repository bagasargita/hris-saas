import { Body, Controller, Get, HttpStatus, Injectable, Module, Post } from '@nestjs/common';
import { ApiNotImplementedResponse, ApiTags } from '@nestjs/swagger';
import { type BillingDto, PLAN_KEYS, PLANS, type PlanKey } from '@saas/contracts';
import { IsIn } from 'class-validator';
import { RequirePermissions, Tenant, TenantScoped } from '../../common/decorators';
import { AppException } from '../../common/errors/app-exception';
import { type TenantContext } from '../../common/http/request-context';
import { PrismaService } from '../../database/prisma.service';

/**
 * Integration boundary for a payment provider (e.g. Stripe). No provider is configured in this
 * codebase, so plan changes are rejected with 501 instead of pretending a charge happened.
 * Implement this interface and bind it in BillingModule to enable checkout.
 */
export interface BillingProvider {
  readonly configured: boolean;
  createCheckoutSession(input: { tenantId: string; plan: PlanKey }): Promise<{ url: string }>;
}

@Injectable()
export class UnconfiguredBillingProvider implements BillingProvider {
  readonly configured = false;

  createCheckoutSession(_input: { tenantId: string; plan: PlanKey }): Promise<{ url: string }> {
    return Promise.reject(
      new AppException(
        'NOT_IMPLEMENTED',
        'Billing provider is not configured. Plan changes are unavailable in this deployment.',
        HttpStatus.NOT_IMPLEMENTED,
      ),
    );
  }
}

export class CheckoutDto {
  @IsIn(PLAN_KEYS)
  plan!: PlanKey;
}

@ApiTags('billing')
@TenantScoped('billing.read')
@Controller('tenants/:tenantId/billing')
export class BillingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: UnconfiguredBillingProvider,
  ) {}

  @Get()
  async get(@Tenant() tenant: TenantContext): Promise<BillingDto> {
    const memberCount = await this.prisma.membership.count({
      where: { tenantId: tenant.tenant.id, status: 'ACTIVE' },
    });
    const plan = PLANS.find((p) => p.key === tenant.tenant.plan);
    return {
      plan: tenant.tenant.plan,
      providerConfigured: this.provider.configured,
      memberCount,
      memberLimit: plan?.memberLimit ?? null,
    };
  }

  @RequirePermissions('billing.manage')
  @ApiNotImplementedResponse({ description: 'No billing provider configured' })
  @Post('checkout')
  checkout(@Tenant() tenant: TenantContext, @Body() dto: CheckoutDto): Promise<{ url: string }> {
    return this.provider.createCheckoutSession({ tenantId: tenant.tenant.id, plan: dto.plan });
  }
}

@Module({
  controllers: [BillingController],
  providers: [UnconfiguredBillingProvider],
})
export class BillingModule {}
