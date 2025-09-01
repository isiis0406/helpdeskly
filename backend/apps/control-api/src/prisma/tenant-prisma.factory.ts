// ════════════════════════════════════════════════════
// 🔄 TENANT PRISMA FACTORY POUR CONTROL-API
// ════════════════════════════════════════════════════

import { PrismaClient } from '.prisma/tenant';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { LRUCache } from 'lru-cache';

interface CachedTenantClient {
  client: PrismaClient;
  lastAccessed: number;
  connectionCount: number;
  dbUrl: string;
}

interface ConnectionMetrics {
  totalConnections: number;
  activeClients: number;
  cacheHits: number;
  cacheMisses: number;
}

@Injectable()
export class TenantPrismaFactory implements OnModuleDestroy {
  private readonly logger = new Logger(TenantPrismaFactory.name);

  // Cache LRU avec limites strictes
  private readonly cache = new LRUCache<string, CachedTenantClient>({
    max: 30, // Moins que dans app-api car usage plus ponctuel
    ttl: 1000 * 60 * 15, // TTL 15 minutes
    dispose: async (cached) => {
      await this.disconnectClient(cached);
    },
  });

  // Métriques
  private metrics: ConnectionMetrics = {
    totalConnections: 0,
    activeClients: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  // Limites de sécurité
  private readonly maxTotalConnections = 50; // Moins que app-api
  private readonly connectionTimeout = 10000; // 10s

  // Health check automatique
  private healthCheckInterval: NodeJS.Timeout;

  constructor() {
    // Health check toutes les 10 minutes
    this.healthCheckInterval = setInterval(
      () => {
        this.performHealthChecks();
      },
      10 * 60 * 1000,
    );
  }

  // ════════════════════════════════════════════════════
  // 🔄 CRÉATION DE CLIENT
  // ════════════════════════════════════════════════════

  async createClient(dbUrl: string): Promise<PrismaClient> {
    const cacheKey = this.getCacheKey(dbUrl);

    // 1. Vérification des limites globales
    this.checkGlobalLimits();

    // 2. Récupération depuis le cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.dbUrl === dbUrl) {
      cached.lastAccessed = Date.now();
      cached.connectionCount++;
      this.metrics.cacheHits++;

      this.logger.debug(`✅ Cache hit for tenant DB: ${this.maskUrl(dbUrl)}`);
      return cached.client;
    }

    // 3. Création d'un nouveau client
    this.metrics.cacheMisses++;
    return await this.createNewClient(cacheKey, dbUrl);
  }

  // ════════════════════════════════════════════════════
  // 🔧 MÉTHODES PRIVÉES
  // ════════════════════════════════════════════════════

  private checkGlobalLimits(): void {
    if (this.metrics.totalConnections >= this.maxTotalConnections) {
      this.logger.error(
        `Maximum total connections reached: ${this.maxTotalConnections}`,
      );
      throw new Error('Connection pool exhausted in control-api');
    }

    if (this.cache.size >= this.cache.max!) {
      this.logger.warn('Cache is full, oldest entries will be evicted');
    }
  }

  private async createNewClient(
    cacheKey: string,
    dbUrl: string,
  ): Promise<PrismaClient> {
    this.logger.log(
      `🔄 Creating new Prisma client for tenant DB: ${this.maskUrl(dbUrl)}`,
    );

    try {
      const client = new PrismaClient({
        datasources: {
          db: { url: dbUrl },
        },
        log:
          process.env.NODE_ENV === 'development'
            ? ['warn', 'error']
            : ['error'],
      });

      // Test de connexion avec timeout
      await Promise.race([
        client.$connect(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Connection timeout')),
            this.connectionTimeout,
          ),
        ),
      ]);

      // Test basique de fonctionnement
      await client.$queryRaw`SELECT 1`;

      // Ajout au cache
      const cached: CachedTenantClient = {
        client,
        lastAccessed: Date.now(),
        connectionCount: 1,
        dbUrl,
      };

      this.cache.set(cacheKey, cached);
      this.metrics.totalConnections++;
      this.metrics.activeClients = this.cache.size;

      this.logger.log(
        `✅ Successfully connected to tenant DB: ${this.maskUrl(dbUrl)}`,
      );
      return client;
    } catch (error) {
      this.logger.error(
        `❌ Failed to connect to tenant DB: ${this.maskUrl(dbUrl)}`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(`Database connection failed for tenant DB`);
    }
  }

  private async disconnectClient(cached: CachedTenantClient): Promise<void> {
    try {
      await cached.client.$disconnect();
      this.metrics.totalConnections--;
      this.metrics.activeClients = this.cache.size;

      this.logger.debug(
        `🔌 Client disconnected: ${this.maskUrl(cached.dbUrl)}`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Error disconnecting client',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async performHealthChecks(): Promise<void> {
    this.logger.debug('🏥 Performing health checks on cached connections');

    for (const [cacheKey, cached] of this.cache.entries()) {
      try {
        // Test simple de connectivité
        await Promise.race([
          cached.client.$queryRaw`SELECT 1`,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), 5000),
          ),
        ]);

        // Vérification de l'inactivité (plus stricte que app-api)
        const inactiveTime = Date.now() - cached.lastAccessed;
        if (inactiveTime > 20 * 60 * 1000) {
          // 20 minutes
          this.logger.debug(
            `🗑️ Removing inactive client: ${this.maskUrl(cached.dbUrl)}`,
          );
          this.cache.delete(cacheKey);
        }
      } catch (error) {
        this.logger.warn(
          `⚠️ Health check failed for ${this.maskUrl(cached.dbUrl)}, removing from cache`,
        );
        this.cache.delete(cacheKey);
      }
    }
  }

  private getCacheKey(dbUrl: string): string {
    // Utiliser un hash de l'URL pour le cache key
    return Buffer.from(dbUrl).toString('base64').slice(0, 20);
  }

  private maskUrl(dbUrl: string): string {
    // Masquer les infos sensibles dans les logs
    return dbUrl.replace(/:\/\/[^@]*@/, '://***:***@');
  }

  // ════════════════════════════════════════════════════
  // 📊 MÉTRIQUES ET UTILITAIRES
  // ════════════════════════════════════════════════════

  getMetrics(): ConnectionMetrics {
    return {
      ...this.metrics,
      activeClients: this.cache.size,
    };
  }

  async clearCache(): Promise<void> {
    this.logger.log('🧹 Clearing all cached connections');
    this.cache.clear();
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      max: this.cache.max,
      ttl: this.cache.ttl,
      metrics: this.getMetrics(),
    };
  }

  // ════════════════════════════════════════════════════
  // 🧹 CLEANUP
  // ════════════════════════════════════════════════════

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.healthCheckInterval);

    this.logger.log('🛑 Disconnecting all cached Prisma clients');

    const disconnectPromises = Array.from(this.cache.values()).map((cached) =>
      this.disconnectClient(cached),
    );

    await Promise.allSettled(disconnectPromises);
    this.cache.clear();

    this.logger.log('✅ All tenant connections closed');
  }
}
