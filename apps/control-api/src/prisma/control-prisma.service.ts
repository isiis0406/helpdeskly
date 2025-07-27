import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "../../../../node_modules/.prisma/control";

/**
 * Client Prisma relié à la base “control” (celle qui stocke les métadonnées des tenants).
 * On le rend injectable partout dans l’app grâce au décorateur @Injectable().
 * Les hooks onModuleInit / onModuleDestroy connectent-déconnectent automatiquement.
 */
@Injectable()
export class ControlPrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
