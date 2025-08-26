import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

// ✅ Imports des décorateurs
import {
  Public,
  RequirePermissions,
  RequireRoles,
} from '../auth/decortors/permissions.decorator';
import {
  RateLimitModerate,
  RateLimitStrict,
  SkipRateLimit,
} from '../auth/decortors/rate.decorator';

// ✅ Imports des guards
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';

// ✅ Imports des DTOs
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantSignupDto } from './dto/tenant-signup.dto';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(RateLimitGuard, JwtAuthGuard, PermissionsGuard) // ✅ Ordre important
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // ================================
  // 🌍 ROUTES PUBLIQUES
  // ================================

  @Post('signup')
  @Public() // ✅ Route publique
  @RateLimitStrict() // ✅ Protection stricte: 3 tentatives/15min
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '🚀 Inscription SaaS complète',
    description: `
      Crée un nouveau tenant avec administrateur en une seule étape.
      
      **Ce qui se passe :**
      1. Validation des données (slug unique, email valide, CGU acceptées)
      2. Création du tenant en mode TRIAL (14 jours)
      3. Création de l'utilisateur administrateur
      4. Provisioning de la base de données (asynchrone)
      5. Authentification automatique
      6. Email de bienvenue
      
      **Protections actives :**
      - Rate limiting: 3 tentatives par IP / 15 minutes
      - Validation anti-spam et sécurité
      - Slugs réservés bloqués
      - Emails temporaires interdits
    `,
  })
  @ApiCreatedResponse({
    description: 'Tenant créé et utilisateur authentifié avec succès',
    schema: {
      example: {
        tenant: {
          id: 'cm123abc456def789',
          slug: 'ma-startup',
          name: 'Ma Startup',
          status: 'TRIAL',
          trialEndsAt: '2024-09-10T15:27:41.000Z',
          url: 'https://ma-startup.helpdeskly.com',
        },
        admin: {
          id: 'user-456',
          name: 'John Doe',
          email: 'john@startup.com',
          role: 'OWNER',
        },
        tokens: {
          accessToken: 'eyJhbGciOiJIUzI1NiIs...',
          refreshToken: 'refresh_token_here',
          expiresIn: 900,
        },
        onboarding: {
          nextSteps: [
            'Personnaliser votre workspace',
            'Inviter votre équipe',
            'Configurer les catégories de tickets',
          ],
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Slug déjà utilisé ou email existant',
    schema: {
      example: {
        statusCode: 409,
        message: 'Tenant slug "ma-startup" is already taken',
        error: 'Conflict',
        suggestions: ['ma-startup-2', 'ma-startup-inc', 'startup-ma'],
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Données invalides ou CGU non acceptées',
    schema: {
      example: {
        statusCode: 400,
        message: [
          'adminEmail must be a valid email',
          'tenantSlug can only contain lowercase letters, numbers, and hyphens',
          'acceptTerms must be true',
        ],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Trop de tentatives - Rate limit dépassé',
    schema: {
      example: {
        statusCode: 429,
        message: 'Too many requests. Please try again in 12 minutes.',
        error: 'Too Many Requests',
        retryAfter: 720,
      },
    },
  })
  async signup(@Body() signupDto: TenantSignupDto, @Request() req: any) {
    const metadata = {
      ip: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
    };

    return this.tenantsService.signupTenant(signupDto, metadata);
  }

  // ================================
  // 🔐 ROUTES PROTÉGÉES - CRÉATION
  // ================================

  @Post()
  @RequirePermissions('tenants.create')
  @RateLimitModerate() // ✅ Plus permissif pour utilisateurs auth
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un tenant supplémentaire',
    description: `
      Crée un nouveau tenant pour un utilisateur déjà authentifié.
      Utilisé pour les cas où un utilisateur veut créer un second workspace.
      
      **Permissions requises :** Utilisateur authentifié
    `,
  })
  @ApiCreatedResponse({ description: 'Tenant créé avec succès' })
  @ApiConflictResponse({ description: 'Un tenant avec ce slug existe déjà' })
  @ApiBadRequestResponse({ description: 'Slug invalide ou réservé' })
  @ApiUnauthorizedResponse({ description: 'Token invalide' })
  @ApiForbiddenResponse({ description: 'Permissions insuffisantes' })
  async create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.createTenant(createTenantDto);
  }

  // ================================
  // 🔐 ROUTES PROTÉGÉES - LECTURE
  // ================================

  @Get()
  @RequireRoles('SUPER_ADMIN')
  @RateLimitModerate()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Lister tous les tenants (Admin seulement)',
    description: `
      Récupère la liste de tous les tenants avec leurs informations complètes.
      
      **Accès limité :** Super administrateurs (@helpdeskly.com) uniquement
      **Utilisation :** Administration, monitoring, support client
    `,
  })
  @ApiOkResponse({
    description: 'Liste complète des tenants',
    schema: {
      example: [
        {
          id: 'cm123abc456def789',
          name: 'Ma Entreprise',
          slug: 'ma-entreprise',
          status: 'ACTIVE',
          trialEndsAt: '2024-01-15T10:30:00.000Z',
          createdAt: '2023-12-01T10:30:00.000Z',
          updatedAt: '2023-12-01T10:30:00.000Z',
          memberships: [
            {
              id: 'membership-123',
              role: 'OWNER',
              isActive: true,
              user: {
                id: 'user-456',
                name: 'John Doe',
                email: 'john@example.com',
                avatar: null,
              },
            },
          ],
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Token invalide' })
  @ApiForbiddenResponse({ description: 'Accès super admin requis' })
  async findAll() {
    return this.tenantsService.findAll();
  }

  @Get('my-tenants')
  @RequirePermissions('tenants.read')
  @RateLimitModerate()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Mes tenants',
    description: `
      Récupère uniquement les tenants auxquels l'utilisateur appartient.
      Inclut le rôle de l'utilisateur dans chaque tenant.
    `,
  })
  @ApiOkResponse({
    description: "Tenants de l'utilisateur",
    schema: {
      example: [
        {
          id: 'cm123abc456def789',
          name: 'Ma Entreprise',
          slug: 'ma-entreprise',
          status: 'ACTIVE',
          role: 'OWNER', // Rôle de l'utilisateur dans ce tenant
          trialEndsAt: '2024-01-15T10:30:00.000Z',
          memberSince: '2023-12-01T10:30:00.000Z',
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Token invalide' })
  @ApiForbiddenResponse({ description: 'Aucun tenant accessible' })
  async findMyTenants(@Request() req) {
    return this.tenantsService.findTenantsForUser(req.user.sub);
  }

  @Get(':id')
  @RequirePermissions('tenants.read')
  @RateLimitModerate()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "Détails d'un tenant",
    description: `
      Récupère les détails d'un tenant spécifique.
      L'utilisateur doit être membre du tenant ou super admin pour y accéder.
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'ID unique du tenant',
    example: 'cm123abc456def789',
  })
  @ApiOkResponse({ description: 'Détails du tenant' })
  @ApiNotFoundResponse({ description: 'Tenant non trouvé' })
  @ApiForbiddenResponse({ description: 'Accès refusé à ce tenant' })
  @ApiUnauthorizedResponse({ description: 'Token invalide' })
  async findOne(@Param('id') id: string, @Request() req) {
    // Vérifier l'accès au tenant
    await this.checkTenantAccess(id, req.user);
    return this.tenantsService.findOne(id);
  }

  // ================================
  // 🔐 ROUTES SYSTÈME/ADMIN
  // ================================

  @Get('slug/:slug')
  @RequireRoles('SUPER_ADMIN')
  @SkipRateLimit() // ✅ Route système - pas de limite
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Rechercher un tenant par slug (Système)',
    description: `
      Récupère un tenant par son slug.
      
      **Usage système :** 
      - Résolution de tenant pour l'app-api
      - Vérification d'existence lors du routage
      - Intégrations internes
      
      **Accès :** Super administrateurs uniquement
    `,
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug unique du tenant',
    example: 'ma-entreprise',
  })
  @ApiOkResponse({ description: 'Tenant trouvé' })
  @ApiNotFoundResponse({ description: 'Tenant non trouvé' })
  @ApiForbiddenResponse({ description: 'Accès super admin requis' })
  @ApiUnauthorizedResponse({ description: 'Token invalide' })
  async findBySlug(@Param('slug') slug: string) {
    const tenant = await this.tenantsService.findBySlug(slug);
    if (!tenant) {
      throw new Error(`Tenant with slug '${slug}' not found`);
    }
    return tenant;
  }

  // ================================
  // 🔐 ROUTES PROTÉGÉES - GESTION
  // ================================

  @Patch(':id/status')
  @RequirePermissions('tenants.manage')
  @RateLimitModerate()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "Changer le statut d'un tenant",
    description: `
      Met à jour le statut d'un tenant (ACTIVE, INACTIVE, SUSPENDED).
      
      **Permissions :** Propriétaire du tenant ou super admin
      **Cas d'usage :** Suspendre un compte, réactiver après paiement
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'ID du tenant',
    example: 'cm123abc456def789',
  })
  @ApiOkResponse({ description: 'Statut mis à jour avec succès' })
  @ApiNotFoundResponse({ description: 'Tenant non trouvé' })
  @ApiForbiddenResponse({ description: 'Permissions insuffisantes' })
  @ApiUnauthorizedResponse({ description: 'Token invalide' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' },
    @Request() req,
  ) {
    await this.checkTenantManageAccess(id, req.user);
    return this.tenantsService.updateStatus(id, body.status);
  }

  @Patch(':id/database')
  @RequireRoles('SUPER_ADMIN')
  @SkipRateLimit() // ✅ Route système
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Mettre à jour la connexion base de données (Système)',
    description: `
      Met à jour les informations de connexion à la base de données.
      
      **Usage système uniquement :**
      - Processus de provisioning
      - Migration de serveurs
      - Maintenance infrastructure
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'ID du tenant',
    example: 'cm123abc456def789',
  })
  @ApiOkResponse({ description: 'Connexion base de données mise à jour' })
  @ApiForbiddenResponse({ description: 'Accès système requis' })
  @ApiUnauthorizedResponse({ description: 'Token invalide' })
  async updateDatabaseConnection(
    @Param('id') id: string,
    @Body() body: { dbUrl?: string; secretRef?: string },
  ) {
    return this.tenantsService.updateDatabaseConnection(
      id,
      body.dbUrl,
      body.secretRef,
    );
  }

  // ================================
  // 🛠️ MÉTHODES UTILITAIRES PRIVÉES
  // ================================

  /**
   * Vérifie que l'utilisateur peut accéder à un tenant
   */
  private async checkTenantAccess(tenantId: string, user: any): Promise<void> {
    // Super admin a accès à tout
    if (this.isSuperAdmin(user)) {
      return;
    }

    // Vérifier que l'utilisateur est membre du tenant
    const isMember = user.memberships?.some(
      (membership: any) =>
        membership.tenantId === tenantId && membership.isActive,
    );

    if (!isMember) {
      throw new ForbiddenException('Access denied to this tenant');
    }
  }

  /**
   * Vérifie que l'utilisateur peut gérer un tenant
   */
  private async checkTenantManageAccess(
    tenantId: string,
    user: any,
  ): Promise<void> {
    // Super admin a accès à tout
    if (this.isSuperAdmin(user)) {
      return;
    }

    // Vérifier que l'utilisateur est propriétaire ou admin du tenant
    const canManage = user.memberships?.some(
      (membership: any) =>
        membership.tenantId === tenantId &&
        membership.isActive &&
        ['OWNER', 'ADMIN'].includes(membership.role),
    );

    if (!canManage) {
      throw new ForbiddenException(
        'Insufficient permissions to manage this tenant',
      );
    }
  }

  /**
   * Vérifie si un utilisateur est super admin
   */
  private isSuperAdmin(user: any): boolean {
    return (
      user.email?.includes('@helpdeskly.com') || user.isSuperAdmin === true
    );
  }
}
