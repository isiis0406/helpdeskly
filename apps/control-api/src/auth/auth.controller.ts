import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.register(
      registerDto.email,
      registerDto.password,
      registerDto.name,
      registerDto.tenantSlug,
      { ip, userAgent },
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.login(
      loginDto.email,
      loginDto.password,
      loginDto.tenantSlug,
      { ip, userAgent },
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshDto: RefreshTokenDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.refreshTokens(refreshDto.refreshToken, {
      ip,
      userAgent,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('switch-tenant/:tenantSlug')
  @HttpCode(HttpStatus.OK)
  async switchTenant(
    @Request() req,
    @Param('tenantSlug') tenantSlug: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.switchTenant(req.user.sub, tenantSlug, {
      ip,
      userAgent,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req) {
    return {
      user: {
        id: req.user.sub,
        email: req.user.email,
        name: req.user.name,
        avatar: req.user.avatar,
      },
      currentTenant: req.user.currentTenantId
        ? {
            id: req.user.currentTenantId,
            slug: req.user.currentTenantSlug,
          }
        : null,
      memberships: req.user.memberships,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() refreshDto: RefreshTokenDto) {
    await this.authService.logout(refreshDto.refreshToken);
    return;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAllDevices(@Request() req) {
    await this.authService.logoutAllDevices(req.user.sub);
    return;
  }
}
