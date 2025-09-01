// ════════════════════════════════════════════════════
// 📊 SERVICE TRACKING D'USAGE COMPLET - CORRIGÉ
// ════════════════════════════════════════════════════

import { UsageMetricType } from '.prisma/control';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ControlPrismaService } from '../../prisma/control-prisma.service';
import { TenantPrismaFactory } from '../../prisma/tenant-prisma.factory';

export interface UsageMetrics {
  users: number;
  tickets: number;
  storage: number;
  apiCalls: number;
  comments: number;
}

export interface UsageRecord {
  metricType: UsageMetricType;
  value: number;
  previousValue: number;
  recordedAt: Date;
  metadata?: any;
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    private controlPrisma: ControlPrismaService,
    private tenantPrismaFactory: TenantPrismaFactory, // ✅ CORRIGÉ: nom cohérent
  ) {}

  // ════════════════════════════════════════════════════
  // 📊 TRACKING D'USAGE PRINCIPAL
  // ════════════════════════════════════════════════════

  async getCurrentUsage(tenantId: string): Promise<UsageMetrics> {
    try {
      // 1. Récupérer les métriques depuis la DB control (cache)
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const usageRecords = await this.controlPrisma.usageRecord.findMany({
        where: {
          tenantId,
          recordedMonth: currentMonth,
          recordedYear: currentYear,
        },
      });

      // 2. Construire l'objet de métriques
      const usage: UsageMetrics = {
        users: 0,
        tickets: 0,
        storage: 0,
        apiCalls: 0,
        comments: 0,
      };

      usageRecords.forEach((record) => {
        switch (record.metricType) {
          case UsageMetricType.USERS:
            usage.users = record.value;
            break;
          case UsageMetricType.TICKETS:
            usage.tickets = record.value;
            break;
          case UsageMetricType.STORAGE:
            usage.storage = record.value;
            break;
          case UsageMetricType.API_CALLS:
            usage.apiCalls = record.value;
            break;
          case UsageMetricType.COMMENTS:
            usage.comments = record.value;
            break;
        }
      });

      return usage;
    } catch (error) {
      this.logger.error(
        `❌ Failed to get current usage for tenant ${tenantId}:`,
        error instanceof Error ? error.message : String(error),
      );

      // Fallback: calculer en temps réel si le cache échoue
      return this.calculateRealTimeUsage(tenantId);
    }
  }

  async recordUsage(
    tenantId: string,
    metricType: UsageMetricType,
    value: number,
    metadata?: any,
  ): Promise<void> {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // ✅ CORRIGÉ: Récupérer la valeur précédente correctement
      const existingRecord = await this.controlPrisma.usageRecord.findUnique({
        where: {
          tenantId_metricType_recordedMonth_recordedYear: {
            tenantId,
            metricType,
            recordedMonth: currentMonth,
            recordedYear: currentYear,
          },
        },
      });

      // Upsert du record d'usage
      await this.controlPrisma.usageRecord.upsert({
        where: {
          tenantId_metricType_recordedMonth_recordedYear: {
            tenantId,
            metricType,
            recordedMonth: currentMonth,
            recordedYear: currentYear,
          },
        },
        update: {
          previousValue: existingRecord?.value || 0, // ✅ CORRIGÉ: structure correcte
          value,
          metadata,
          recordedAt: new Date(),
        },
        create: {
          tenantId,
          metricType,
          value,
          previousValue: 0,
          recordedMonth: currentMonth,
          recordedYear: currentYear,
          metadata,
        },
      });

      this.logger.debug(
        `📊 Usage recorded - Tenant: ${tenantId}, Metric: ${metricType}, Value: ${value}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to record usage:`,
        error instanceof Error ? error.message : String(error),
      );
      // Ne pas throw pour éviter de casser le processus principal
    }
  }

  // ════════════════════════════════════════════════════
  // 🔄 SYNCHRONISATION DEPUIS LES TENANT DB
  // ════════════════════════════════════════════════════

  async syncUsageFromTenantDB(tenantId: string): Promise<UsageMetrics> {
    try {
      // 1. Récupérer les infos du tenant
      const tenant = await this.controlPrisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant || !tenant.dbUrl) {
        throw new Error(`Tenant ${tenantId} not found or no database URL`);
      }

      // 2. Se connecter à la tenant DB
      const tenantPrisma = await this.tenantPrismaFactory.createClient(
        tenant.dbUrl,
      ); // ✅ CORRIGÉ: méthode createClient

      // 3. Calculer les métriques en temps réel
      const [userCount, ticketCount, commentCount] = await Promise.all([
        // Compter les utilisateurs actifs (depuis control DB)
        this.controlPrisma.membership.count({
          where: {
            tenantId,
            isActive: true,
          },
        }),

        // Compter les tickets
        tenantPrisma.ticket.count(),

        // Compter les commentaires
        tenantPrisma.comment.count(),
      ]);

      // 4. Calculer le storage (estimation basique)
      const storageUsage = await this.calculateStorageUsage(tenantPrisma);

      // 5. Récupérer les API calls du mois en cours
      const apiCalls = await this.getMonthlyApiCalls(tenantId);

      const usage: UsageMetrics = {
        users: userCount,
        tickets: ticketCount,
        storage: storageUsage,
        apiCalls,
        comments: commentCount,
      };

      // 6. Enregistrer dans le cache
      await this.cacheUsageMetrics(tenantId, usage);

      this.logger.log(`✅ Usage synced for tenant ${tenantId}:`, usage);

      return usage;
    } catch (error) {
      this.logger.error(
        `❌ Failed to sync usage for tenant ${tenantId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  // ════════════════════════════════════════════════════
  // 🔧 HELPERS PRIVÉS - INCHANGÉS
  // ════════════════════════════════════════════════════

  private async calculateRealTimeUsage(
    tenantId: string,
  ): Promise<UsageMetrics> {
    // Calcul de base sans cache - pour les fallbacks
    const userCount = await this.controlPrisma.membership.count({
      where: { tenantId, isActive: true },
    });

    return {
      users: userCount,
      tickets: 0,
      storage: 0,
      apiCalls: 0,
      comments: 0,
    };
  }

  private async calculateStorageUsage(tenantPrisma: any): Promise<number> {
    try {
      // Estimation simple basée sur le nombre d'enregistrements
      const [ticketCount, commentCount] = await Promise.all([
        tenantPrisma.ticket.count(),
        tenantPrisma.comment.count(),
      ]);

      // Estimation: ~1KB par ticket, ~0.5KB par commentaire
      const estimatedStorage = ticketCount * 1 + commentCount * 0.5;

      return Math.round(estimatedStorage);
    } catch (error) {
      this.logger.warn(
        'Failed to calculate storage usage:',
        error instanceof Error ? error.message : String(error),
      );
      return 0;
    }
  }

  private async getMonthlyApiCalls(tenantId: string): Promise<number> {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const record = await this.controlPrisma.usageRecord.findUnique({
      where: {
        tenantId_metricType_recordedMonth_recordedYear: {
          tenantId,
          metricType: UsageMetricType.API_CALLS,
          recordedMonth: currentMonth,
          recordedYear: currentYear,
        },
      },
    });

    return record?.value || 0;
  }

  private async cacheUsageMetrics(
    tenantId: string,
    usage: UsageMetrics,
  ): Promise<void> {
    const promises = Object.entries(usage).map(([metric, value]) => {
      const metricType = metric.toUpperCase() as UsageMetricType;
      if (Object.values(UsageMetricType).includes(metricType)) {
        return this.recordUsage(tenantId, metricType, value);
      }
    });

    await Promise.allSettled(promises);
  }

  // ════════════════════════════════════════════════════
  // ⏰ TÂCHES CRON ET AUTRES MÉTHODES - INCHANGÉES
  // ════════════════════════════════════════════════════

  async incrementUsage(
    tenantId: string,
    metricType: UsageMetricType,
    incrementBy: number = 1,
    metadata?: any,
  ): Promise<number> {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const currentRecord = await this.controlPrisma.usageRecord.findUnique({
        where: {
          tenantId_metricType_recordedMonth_recordedYear: {
            tenantId,
            metricType,
            recordedMonth: currentMonth,
            recordedYear: currentYear,
          },
        },
      });

      const currentValue = currentRecord?.value || 0;
      const newValue = currentValue + incrementBy;

      await this.recordUsage(tenantId, metricType, newValue, metadata);

      return newValue;
    } catch (error) {
      this.logger.error(
        `❌ Failed to increment usage:`,
        error instanceof Error ? error.message : String(error),
      );
      return 0;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async syncAllTenantsUsage(): Promise<void> {
    this.logger.log('🔄 Starting hourly usage sync for all tenants...');

    try {
      const tenants = await this.controlPrisma.tenant.findMany({
        where: {
          status: 'ACTIVE',
          dbUrl: { not: null },
        },
        select: { id: true, slug: true },
      });

      this.logger.log(`📊 Syncing usage for ${tenants.length} tenants`);

      const batchSize = 10;
      for (let i = 0; i < tenants.length; i += batchSize) {
        const batch = tenants.slice(i, i + batchSize);

        await Promise.allSettled(
          batch.map((tenant) =>
            this.syncUsageFromTenantDB(tenant.id).catch((error) =>
              this.logger.warn(
                `Failed to sync usage for tenant ${tenant.slug}: ${error instanceof Error ? error.message : String(error)}`,
              ),
            ),
          ),
        );

        if (i + batchSize < tenants.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      this.logger.log('✅ Hourly usage sync completed');
    } catch (error) {
      this.logger.error(
        '❌ Failed to complete usage sync:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async cleanupOldUsageRecords(): Promise<void> {
    this.logger.log('🧹 Cleaning up old usage records...');

    try {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 13);

      const deleted = await this.controlPrisma.usageRecord.deleteMany({
        where: {
          recordedAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`✅ Deleted ${deleted.count} old usage records`);
    } catch (error) {
      this.logger.error(
        '❌ Failed to cleanup usage records:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async initializeUsageTracking(tenantId: string): Promise<void> {
    this.logger.log(`� Initializing usage tracking for tenant ${tenantId}`);

    try {
      await this.syncUsageFromTenantDB(tenantId);
    } catch (error) {
      this.logger.warn(
        `Failed to initialize usage tracking for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Méthodes pour les historiques et rapports - inchangées
  async getUsageHistory(
    tenantId: string,
    metricType: UsageMetricType,
    months: number = 12,
  ): Promise<
    Array<{
      month: number;
      year: number;
      value: number;
      date: string;
    }>
  > {
    const records = await this.controlPrisma.usageRecord.findMany({
      where: {
        tenantId,
        metricType,
      },
      orderBy: [{ recordedYear: 'desc' }, { recordedMonth: 'desc' }],
      take: months,
    });

    return records.map((record) => ({
      month: record.recordedMonth,
      year: record.recordedYear,
      value: record.value,
      date: `${record.recordedYear}-${record.recordedMonth.toString().padStart(2, '0')}`,
    }));
  }

  async getUsageTrends(tenantId: string): Promise<{
    trends: Record<
      UsageMetricType,
      {
        current: number;
        previous: number;
        change: number;
        changePercent: number;
      }
    >;
  }> {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    let previousMonth = currentMonth - 1;
    let previousYear = currentYear;

    if (previousMonth === 0) {
      previousMonth = 12;
      previousYear -= 1;
    }

    const [currentRecords, previousRecords] = await Promise.all([
      this.controlPrisma.usageRecord.findMany({
        where: {
          tenantId,
          recordedMonth: currentMonth,
          recordedYear: currentYear,
        },
      }),
      this.controlPrisma.usageRecord.findMany({
        where: {
          tenantId,
          recordedMonth: previousMonth,
          recordedYear: previousYear,
        },
      }),
    ]);

    const trends: any = {};

    Object.values(UsageMetricType).forEach((metricType) => {
      const current =
        currentRecords.find((r) => r.metricType === metricType)?.value || 0;
      const previous =
        previousRecords.find((r) => r.metricType === metricType)?.value || 0;
      const change = current - previous;
      const changePercent = previous > 0 ? (change / previous) * 100 : 0;

      trends[metricType] = {
        current,
        previous,
        change,
        changePercent: Math.round(changePercent * 100) / 100,
      };
    });

    return { trends };
  }
}
