import { Global, MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';

// Middleware et services
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';
import { DatabaseUrlService } from './services/database-url.service';
import { TenantPrismaService } from './services/tenant-prisma.service';
import { TenantResolutionService } from './services/tenant-resolution.service';

// Prisma services
import { ControlPrismaService } from './prisma/control-prisma.service';
import { TenantClientFactory } from './prisma/tenant-prisma.factory';

// Modules métier
import { TicketModule } from './ticket/ticket.module';

@Global()
@Module({
  imports: [
    // Configuration globale
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Context Local Storage
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req) => {
          // Configuration initiale du CLS si nécessaire
        },
      },
    }),

    // Modules métier
    TicketModule,
  ],

  providers: [
    // 🎯 Services Prisma centralisés
    ControlPrismaService,
    TenantClientFactory,
    TenantPrismaService,
    // 🎯 Services de résolution tenant
    TenantResolutionService,
    DatabaseUrlService,

    // Middleware
    TenantContextMiddleware,
  ],

  exports: [
    // 🔥 Export pour que tous les modules puissent les utiliser
    ControlPrismaService,
    TenantClientFactory,
    TenantPrismaService,
    TenantResolutionService,
    DatabaseUrlService,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*'); // Appliqué sur toutes les routes
  }
}
