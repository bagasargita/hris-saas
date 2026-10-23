import { Controller, Get, HttpStatus, Module, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { type HealthResponse } from '@saas/contracts';
import { type Response } from 'express';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up and serving requests. */
  @Get()
  live(): HealthResponse {
    return { status: 'ok', checks: { process: 'up' } };
  }

  /** Readiness: dependencies are reachable. Returns 503 so load balancers stop routing traffic. */
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', checks: { database: 'up' } };
    } catch {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'error', checks: { database: 'down' } };
    }
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
