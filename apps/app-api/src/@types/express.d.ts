import type { PrismaClient } from '.prisma/tenant';

declare global {
  namespace Express {
    interface Request {
      /** Contexte multi-tenant injecté par le middleware */
      tenant?: {
        id: string;
        slug: string;
        prisma: PrismaClient;
      };
    }
  }
}
