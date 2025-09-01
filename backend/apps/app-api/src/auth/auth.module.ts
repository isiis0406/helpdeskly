import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ControlPrismaService } from '../prisma/control-prisma.service';
import { UserEnrichmentService } from '../user-enrichment/user-enrichment.service';
import { PermissionsGuard } from './guards/permission.guard';
import { TenantJwtGuard } from './guards/tenant-jwt.guard';
import { PermissionsService } from './permissions.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        verifyOptions: {
          issuer: config.get<string>('JWT_ISSUER', 'helpdeskly'),
          audience: config.get<string>('JWT_AUDIENCE', 'helpdeskly-users'),
        },
      }),
    }),
  ],
  providers: [
    TenantJwtGuard,
    PermissionsGuard,
    PermissionsService,
    ControlPrismaService,
    UserEnrichmentService,
  ],
  exports: [TenantJwtGuard, PermissionsGuard, PermissionsService, JwtModule],
})
export class AuthModule {}
