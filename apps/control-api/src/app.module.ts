// apps/control-api/src/app.module.ts
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProvisioningModule } from './provisioning/provisioning.module';
import { TenantsModule } from './tenants/tenants.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // 🔧 CORRECTION: Spécifier tous les chemins possibles
      envFilePath: [
        '.env.local',
        '.env',
        '../../.env', // Depuis apps/control-api vers racine
        '../../../.env', // Au cas où
        process.cwd() + '/.env', // Depuis le répertoire de travail
      ],
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    TenantsModule,
    ProvisioningModule,
    AuthModule,
  ],
  exports: [BullModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
