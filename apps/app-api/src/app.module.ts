import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';
import { ControlPrismaService } from './prisma/control-prisma.service';
import { TenantClientFactory } from './prisma/tenant-prisma.factory';
import { TicketModule } from './ticket/ticket.module';

// app.module.ts
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), TicketModule],
  providers: [
    TenantContextMiddleware,
    TenantClientFactory,
    ControlPrismaService,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
