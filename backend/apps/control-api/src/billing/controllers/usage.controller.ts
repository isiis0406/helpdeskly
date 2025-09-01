import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { UsageRecordDto } from '../dto/usage-record.dto';
import { UsageLimitGuard } from '../guards/usage-limit.guard';
import { UsageService } from '../services/usage.service';

@ApiTags('Usage')
@ApiBearerAuth()
@Controller('usage')
@UseGuards(JwtAuthGuard, TenantGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get('current')
  @ApiOperation({
    summary: 'Usage actuel du tenant',
    description: "Statistiques d'usage en temps réel",
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        users: 12,
        tickets: 145,
        storage: 1024,
        apiCalls: 2500,
        period: 'current_month',
        lastUpdated: '2024-01-15T10:30:00Z',
      },
    },
  })
  async getCurrentUsage(@CurrentTenant('id') tenantId: string) {
    return this.usageService.getCurrentUsage(tenantId);
  }

  @Get('history')
  @ApiOperation({
    summary: "Historique d'usage",
    description: 'Usage par période (jour/semaine/mois)',
  })
  @ApiQuery({ name: 'period', enum: ['day', 'week', 'month'], required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async getUsageHistory(
    @CurrentTenant('id') tenantId: string,
    @Query('period') period: 'day' | 'week' | 'month' = 'month',
    @Query('limit') limit: number = 12,
  ) {
    // Pour l'instant, nous renvoyons l'historique mensuel par métrique
    // en utilisant l'API existante basée sur UsageMetricType
    const { UsageMetricType } = await import('.prisma/control');
    const months = limit;

    const entries = await Promise.all([
      this.usageService.getUsageHistory(tenantId, UsageMetricType.USERS, months),
      this.usageService.getUsageHistory(
        tenantId,
        UsageMetricType.TICKETS,
        months,
      ),
      this.usageService.getUsageHistory(
        tenantId,
        UsageMetricType.STORAGE,
        months,
      ),
      this.usageService.getUsageHistory(
        tenantId,
        UsageMetricType.API_CALLS,
        months,
      ),
      this.usageService.getUsageHistory(
        tenantId,
        UsageMetricType.COMMENTS,
        months,
      ),
    ]);

    return {
      period,
      months,
      users: entries[0],
      tickets: entries[1],
      storage: entries[2],
      apiCalls: entries[3],
      comments: entries[4],
    };
  }

  @Post('record')
  @ApiOperation({
    summary: 'Enregistrer un usage',
    description: 'Enregistre une utilisation de ressource',
  })
  @UseGuards(UsageLimitGuard)
  async recordUsage(
    @CurrentTenant('id') tenantId: string,
    @Body() usageRecord: UsageRecordDto,
  ) {
    const { metricType, value, metadata } = usageRecord;
    await this.usageService.recordUsage(tenantId, metricType, value, metadata);
    return { success: true };
  }
}
