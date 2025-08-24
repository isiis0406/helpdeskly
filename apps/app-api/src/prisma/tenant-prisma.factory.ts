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
export class TenantClientFactory implements OnModuleDestroy {
  private readonly logger = new Logger(TenantClientFactory.name);

  // Cache LRU avec limites strictes
  private readonly cache = new LRUCache<string, CachedTenantClient>({
    max: 50, // Maximum 50 tenants en cache
    ttl: 1000 * 60 * 10, // TTL 10 minutes
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
  private readonly maxConnectionsPerTenant = 5;
  private readonly maxTotalConnections = 100;
  private readonly connectionTimeout = 30000; // 30s

  // Health check automatique
  private healthCheckInterval: NodeJS.Timeout;

  constructor() {
    // Health check toutes les 5 minutes
    this.healthCheckInterval = setInterval(
      () => {
        this.performHealthChecks();
      },
      5 * 60 * 1000,
    );
  }

  // NOUVEAU: Méthode synchrone pour récupérer un client en cache
  getCachedClient(tenantId: string): PrismaClient {
    const cached = this.cache.get(tenantId);
    if (!cached) {
      throw new Error(
        `No cached client for tenant ${tenantId}. Make sure middleware has been applied.`,
      );
    }

    cached.lastAccessed = Date.now();
    cached.connectionCount++;
    this.metrics.cacheHits++;

    return cached.client;
  }

  async getClient(
    tenantId: string,
    dbConfig: {
      url: string;
      poolSize: number;
      connectionTimeout: number;
    },
  ): Promise<PrismaClient> {
    // 1. Vérification des limites globales
    this.checkGlobalLimits();

    // 2. Récupération depuis le cache
    const cached = this.cache.get(tenantId);
    if (cached && cached.dbUrl === dbConfig.url) {
      cached.lastAccessed = Date.now();
      cached.connectionCount++;
      this.metrics.cacheHits++;

      this.logger.debug(`Cache hit for tenant ${tenantId}`);
      return cached.client;
    }

    // 3. Création d'un nouveau client
    this.metrics.cacheMisses++;
    return await this.createNewClient(tenantId, dbConfig);
  }

  private checkGlobalLimits(): void {
    if (this.metrics.totalConnections >= this.maxTotalConnections) {
      this.logger.error(
        `Maximum total connections reached: ${this.maxTotalConnections}`,
      );
      throw new Error('Connection pool exhausted');
    }

    if (this.cache.size >= this.cache.max!) {
      this.logger.warn('Cache is full, oldest entries will be evicted');
    }
  }

  private async createNewClient(
    tenantId: string,
    dbConfig: { url: string; poolSize: number; connectionTimeout: number },
  ): Promise<PrismaClient> {
    this.logger.log(`Creating new Prisma client for tenant: ${tenantId}`);

    try {
      const client = new PrismaClient({
        datasources: { db: { url: dbConfig.url } },
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
            dbConfig.connectionTimeout,
          ),
        ),
      ]);

      // Ajout au cache
      const cached: CachedTenantClient = {
        client,
        lastAccessed: Date.now(),
        connectionCount: 1,
        dbUrl: dbConfig.url,
      };

      this.cache.set(tenantId, cached);
      this.metrics.totalConnections++;
      this.metrics.activeClients = this.cache.size;

      this.logger.log(`Successfully connected to tenant DB: ${tenantId}`);
      return client;
    } catch (error) {
      this.logger.error(`Failed to connect to tenant DB: ${tenantId}`, error);
      throw new Error(`Database connection failed for tenant: ${tenantId}`);
    }
  }

  private async disconnectClient(cached: CachedTenantClient): Promise<void> {
    try {
      await cached.client.$disconnect();
      this.metrics.totalConnections--;
      this.metrics.activeClients = this.cache.size;

      this.logger.debug('Client disconnected from cache eviction');
    } catch (error) {
      this.logger.error('Error disconnecting client', error);
    }
  }

  private async performHealthChecks(): Promise<void> {
    this.logger.debug('Performing health checks on cached connections');

    for (const [tenantId, cached] of this.cache.entries()) {
      try {
        // Test simple de connectivité
        await cached.client.$queryRaw`SELECT 1`;

        // Vérification de l'inactivité
        const inactiveTime = Date.now() - cached.lastAccessed;
        if (inactiveTime > 30 * 60 * 1000) {
          // 30 minutes
          this.logger.debug(`Removing inactive client for tenant: ${tenantId}`);
          this.cache.delete(tenantId);
        }
      } catch (error) {
        this.logger.warn(
          `Health check failed for tenant ${tenantId}, removing from cache`,
        );
        this.cache.delete(tenantId);
      }
    }
  }

  // Métriques pour monitoring
  getMetrics(): ConnectionMetrics {
    return {
      ...this.metrics,
      activeClients: this.cache.size,
    };
  }

  // Nettoyage forcé
  async clearCache(): Promise<void> {
    this.logger.log('Clearing all cached connections');
    this.cache.clear();
  }

  // Cleanup lors de l'arrêt du module
  async onModuleDestroy(): Promise<void> {
    clearInterval(this.healthCheckInterval);

    this.logger.log('Disconnecting all cached Prisma clients');

    for (const [, cached] of this.cache.entries()) {
      await this.disconnectClient(cached);
    }

    this.cache.clear();
  }
}
