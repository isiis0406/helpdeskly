import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  RegisterDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Inscription d'un nouvel utilisateur",
    description: "Permet à un utilisateur de s'inscrire sur la plateforme.",
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Utilisateur créé avec succès',
    type: LoginResponseDto,
  })
  @ApiConflictResponse({
    description: 'Un utilisateur avec cet email existe déjà',
  })
  @ApiBadRequestResponse({ description: "Données d'entrée invalides" })
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
  @ApiOperation({
    summary: "Connexion d'un utilisateur",
    description: 'Authentifie un utilisateur et retourne un token JWT.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Connexion réussie',
    type: LoginResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Identifiants invalides' })
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
  @ApiOperation({
    summary: "Rafraîchir le token d'accès",
    description: "Génère un nouveau token d'accès à partir du refresh token.",
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Token rafraîchi avec succès' })
  @ApiUnauthorizedResponse({ description: 'Refresh token invalide ou expiré' })
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
  @Get('me')
  @ApiBearerAuth('access-token') // ✅ Même nom que la config
  @ApiOperation({
    summary: "Profil de l'utilisateur connecté",
    description: 'Récupère les informations du profil utilisateur.',
  })
  @ApiResponse({ status: 200, description: 'Profil utilisateur' })
  @ApiUnauthorizedResponse({ description: 'Token invalide' })
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

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Déconnexion',
    description: "Déconnecte l'utilisateur et invalide le refresh token.",
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 204, description: 'Déconnexion réussie' })
  @ApiUnauthorizedResponse({ description: 'Refresh token invalide' })
  async logout(@Body() refreshDto: RefreshTokenDto) {
    await this.authService.logout(refreshDto.refreshToken);
    return;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Déconnexion de tous les appareils',
    description: "Invalide toutes les sessions actives de l'utilisateur.",
  })
  @ApiResponse({
    status: 204,
    description: 'Toutes les sessions ont été invalidées',
  })
  @ApiUnauthorizedResponse({ description: 'Token invalide' })
  async logoutAllDevices(@Request() req) {
    await this.authService.logoutAllDevices(req.user.sub);
    return;
  }
}
