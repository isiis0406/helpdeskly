// apps/control-api/src/tenants/tenants.module.ts
import { PrismaClient as ControlPrismaClient } from '.prisma/control';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

// Version simplifiée du TenantsModule
@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'provisioning',
    }),
  ],
  controllers: [TenantsController],
  providers: [
    TenantsService,
    {
      provide: ControlPrismaClient,
      useFactory: () => new ControlPrismaClient(),
    },
  ],
})
export class TenantsModule {}
