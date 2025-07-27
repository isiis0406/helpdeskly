// apps/app-api/src/prisma/tenant-client.factory.ts
import { PrismaClient } from '.prisma/tenant';
import { Injectable, OnModuleDestroy } from '@nestjs/common';

interface Cached {
  client: PrismaClient;
  lastUsed: number;
}

@Injectable()
export class TenantClientFactory implements OnModuleDestroy {
  private cache = new Map<string, Cached>();
  private TTL = 5 * 60 * 1000; // 5 min

  get(url: string): PrismaClient {
    const hit = this.cache.get(url);
    if (hit) {
      hit.lastUsed = Date.now();
      return hit.client;
    }

    const client = new PrismaClient({ datasources: { db: { url } } });
    this.cache.set(url, { client, lastUsed: Date.now() });
    return client;
  }

  private sweep = setInterval(() => {
    const now = Date.now();
    for (const [url, c] of this.cache) {
      if (now - c.lastUsed > this.TTL) {
        void c.client.$disconnect();
        this.cache.delete(url);
      }
    }
  }, 60_000);

  onModuleDestroy() {
    clearInterval(this.sweep);
  }
}
