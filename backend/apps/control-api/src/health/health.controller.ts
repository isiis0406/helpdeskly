import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ControlPrismaService } from '../prisma/control-prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: ControlPrismaService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "État de santé de l'API",
    description: "Vérifie l'état de santé de l'API et de ses dépendances.",
  })
  @ApiResponse({
    status: 200,
    description: 'API en bonne santé',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2023-01-01T00:00:00.000Z',
        version: '1.0.0',
        database: 'connected',
        environment: 'development',
      },
    },
  })
  async check() {
    const start = Date.now();

    // Test de la base de données
    let dbStatus = 'error';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'disconnected';
    }

    const responseTime = Date.now() - start;

    return {
      status: dbStatus === 'connected' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: dbStatus,
      environment: this.config.get('NODE_ENV') || 'development',
      responseTime: `${responseTime}ms`,
      uptime: process.uptime(),
    };
  }
}
