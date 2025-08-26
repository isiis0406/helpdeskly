// apps/control-api/src/tenants/tenants.module.ts
import { PrismaClient as ControlPrismaClient } from '.prisma/control';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from 'src/auth/auth.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ControlPrismaService } from 'src/prisma/control-prisma.service';
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
    JwtService,
    JwtAuthGuard,
    ControlPrismaService,
    AuthService,
    {
      provide: ControlPrismaClient,
      useFactory: () => new ControlPrismaClient(),
    },
  ],
})
export class TenantsModule {}
