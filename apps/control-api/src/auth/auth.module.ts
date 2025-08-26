import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ControlPrismaService } from '../prisma/control-prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m'),
          issuer: config.get<string>('JWT_ISSUER', 'helpdeskly'),
          audience: config.get<string>('JWT_AUDIENCE', 'helpdeskly-users'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, ControlPrismaService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
