import { Controller, Get } from '@nestjs/common';

import { PrismaService } from '../../lib/prisma/prisma.service';
import { LoggerService } from '../../lib/logger/logger.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  @Get()
  async check() {
    const timestamp = new Date().toISOString();

    // Check database connection
    let databaseStatus = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      databaseStatus = 'error';
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : undefined,
        'HealthController'
      );
    }

    return {
      status: databaseStatus === 'ok' ? 'ok' : 'error',
      service: 'coforma-studio',
      version: '0.1.0',
      timestamp,
      services: {
        database: databaseStatus,
        // Redis and Meilisearch health checks will be added when implemented
      },
    };
  }
}
