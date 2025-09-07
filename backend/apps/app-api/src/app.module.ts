import { Global, MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsMiddleware, ClsModule } from 'nestjs-cls';
import { AuthModule } from './auth/auth.module';
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';
import { ControlPrismaService } from './prisma/control-prisma.service';
import { TenantClientFactory } from './prisma/tenant-prisma.factory';
import { DatabaseUrlService } from './services/database-url.service';
import { TenantPrismaService } from './services/tenant-prisma.service';
import { TenantResolutionService } from './services/tenant-resolution.service';
import { TicketModule } from './ticket/ticket.module';
import { UserEnrichmentService } from './user-enrichment/user-enrichment.service';
import { UsersController } from './users/users.controller';

// ... autres imports

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // ✅ SOLUTION PROPRE: CLS sans middleware automatique
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: false, // ✅ On gère manuellement l'ordre
      },
    }),

    TicketModule,
    AuthModule,
  ],

  controllers: [UsersController],
  providers: [
    ControlPrismaService,
    TenantClientFactory,
    TenantPrismaService,
    TenantResolutionService,
    DatabaseUrlService,
    TenantContextMiddleware,
    UserEnrichmentService,
  ],

  exports: [
    ControlPrismaService,
    TenantClientFactory,
    TenantPrismaService,
    TenantResolutionService,
    DatabaseUrlService,
    UserEnrichmentService,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    // ✅ ORDRE CRITIQUE: CLS d'abord, puis tenant
    consumer
      .apply(ClsMiddleware) // ✅ 1. Initialise le contexte CLS
      .forRoutes('*');

    consumer
      .apply(TenantContextMiddleware) // ✅ 2. Configure le tenant
      .forRoutes('*');
  }
}
