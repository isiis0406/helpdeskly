import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ControlPrismaService } from '../prisma/control-prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permission.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';

@Module({
  imports: [
    ConfigModule, // ✅ IMPORTANT
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // ✅ CONFIGURATION JWT COMPLÈTE
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');

        console.log('🔧 AuthModule - JWT_SECRET loaded:', !!secret);
        console.log('🔧 AuthModule - JWT_SECRET value:', secret);

        if (!secret) {
          throw new Error(
            'JWT_SECRET environment variable is required but not found',
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m'),
            issuer: configService.get<string>('JWT_ISSUER', 'helpdeskly'),
            audience: configService.get<string>(
              'JWT_AUDIENCE',
              'helpdeskly-users',
            ),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    ControlPrismaService,
    JwtAuthGuard,
    PermissionsGuard,
    RateLimitGuard,
    // JwtStrategy, // Si tu utilises Passport
  ],
  exports: [
    AuthService,
    JwtModule, // ✅ IMPORTANT pour TenantsModule
    JwtAuthGuard,
    PermissionsGuard,
    RateLimitGuard,
  ],
})
export class AuthModule {}
