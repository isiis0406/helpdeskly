// apps/control-api/src/provisioning/provisioning.module.ts
import { PrismaClient as ControlPrismaClient } from '.prisma/control'; // 🔧 AJOUT
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // 🔧 AJOUT
import { MigratorService } from '../utils/migrator.service';
import { PostgresFactory } from '../utils/postgres.factory';
import { ProvisioningProcessor } from './provisioning.processor';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'provisioning',
    }),
  ],
  providers: [
    ProvisioningProcessor,
    MigratorService,
    PostgresFactory,
    {
      provide: ControlPrismaClient,
      useFactory: () => {
        console.log('🔧 Creating ControlPrismaClient for ProvisioningModule');
        return new ControlPrismaClient();
      },
    },
  ],
})
export class ProvisioningModule {}
