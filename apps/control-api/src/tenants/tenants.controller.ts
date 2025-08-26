import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un nouveau tenant',
    description: `
      Crée un nouveau tenant (organisation) avec sa base de données dédiée.
      Le provisioning de la base de données se fait de manière asynchrone.
      
      **Statuts possibles :**
      - \`PROVISIONING\` : En cours de création
      - \`ACTIVE\` : Prêt à être utilisé
      - \`INACTIVE\` : Temporairement désactivé
      - \`SUSPENDED\` : Suspendu
    `,
  })
  @ApiBody({
    type: CreateTenantDto,
    description: 'Données de création du tenant',
    examples: {
      basic: {
        summary: 'Tenant basique',
        value: {
          slug: 'ma-entreprise',
          tenantName: 'Ma Entreprise',
          description: 'Support client pour Ma Entreprise',
        },
      },
      withTrial: {
        summary: 'Tenant avec essai personnalisé',
        value: {
          slug: 'tech-corp',
          tenantName: 'Tech Corporation',
          description: 'Plateforme de support technique',
          trialDays: 60,
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Tenant créé avec succès (provisioning en cours)',
    schema: {
      example: {
        id: 'cm123abc456def789',
        slug: 'ma-entreprise',
        name: 'Ma Entreprise',
        status: 'PROVISIONING',
        url: 'http://localhost:3000?tenant=ma-entreprise',
        trialEndsAt: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiConflictResponse({
    description: 'Un tenant avec ce slug existe déjà',
    schema: {
      example: {
        statusCode: 409,
        message: "Tenant with slug 'ma-entreprise' already exists",
        error: 'Conflict',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Slug invalide ou réservé',
    schema: {
      example: {
        statusCode: 400,
        message: "Slug 'admin' is reserved",
        error: 'Bad Request',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Token invalide' })
  async create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.createTenant(createTenantDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister tous les tenants',
    description: `
      Récupère la liste de tous les tenants avec leurs informations publiques.
      Les informations sensibles (URLs de base de données) sont exclues.
    `,
  })
  @ApiOkResponse({
    description: 'Liste des tenants',
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
  async findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: "Détails d'un tenant",
    description: `
      Récupère les détails complets d'un tenant spécifique.
      Inclut les membres et leurs rôles.
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant unique du tenant',
    example: 'cm123abc456def789',
  })
  @ApiOkResponse({
    description: 'Détails du tenant',
    schema: {
      example: {
        id: 'cm123abc456def789',
        name: 'Ma Entreprise',
        slug: 'ma-entreprise',
        status: 'ACTIVE',
        trialEndsAt: '2024-01-15T10:30:00.000Z',
        schemaVersion: 1,
        createdAt: '2023-12-01T10:30:00.000Z',
        updatedAt: '2023-12-01T10:30:00.000Z',
        memberships: [
          {
            id: 'membership-123',
            role: 'OWNER',
            isActive: true,
            createdAt: '2023-12-01T10:30:00.000Z',
            user: {
              id: 'user-456',
              name: 'John Doe',
              email: 'john@example.com',
              avatar: null,
              isActive: true,
            },
          },
        ],
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Tenant non trouvé',
    schema: {
      example: {
        statusCode: 404,
        message: 'Tenant with ID cm123abc456def789 not found',
        error: 'Not Found',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Token invalide' })
  async findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Rechercher un tenant par slug',
    description: `
      Récupère un tenant par son slug unique.
      Utilisé pour la résolution de tenant dans l'app-api.
    `,
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug unique du tenant',
    example: 'ma-entreprise',
  })
  @ApiOkResponse({
    description: 'Tenant trouvé',
    schema: {
      example: {
        id: 'cm123abc456def789',
        name: 'Ma Entreprise',
        slug: 'ma-entreprise',
        status: 'ACTIVE',
        dbUrl: 'postgresql://user:pass@localhost:5432/ma_entreprise_db',
        secretRef: null,
        memberships: [
          {
            id: 'membership-123',
            role: 'OWNER',
            user: {
              id: 'user-456',
              name: 'John Doe',
              email: 'john@example.com',
              avatar: null,
            },
          },
        ],
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Tenant non trouvé' })
  async findBySlug(@Param('slug') slug: string) {
    const tenant = await this.tenantsService.findBySlug(slug);
    if (!tenant) {
      throw new Error(`Tenant with slug '${slug}' not found`);
    }
    return tenant;
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: "Changer le statut d'un tenant",
    description: `
      Met à jour le statut d'un tenant.
      
      **Statuts possibles :**
      - \`ACTIVE\` : Tenant actif
      - \`INACTIVE\` : Tenant inactif temporairement
      - \`SUSPENDED\` : Tenant suspendu
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant du tenant',
    example: 'cm123abc456def789',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
          description: 'Nouveau statut du tenant',
          example: 'ACTIVE',
        },
      },
      required: ['status'],
    },
  })
  @ApiOkResponse({
    description: 'Statut mis à jour avec succès',
    schema: {
      example: {
        id: 'cm123abc456def789',
        slug: 'ma-entreprise',
        status: 'ACTIVE',
        updatedAt: '2023-12-01T10:30:00.000Z',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Tenant non trouvé' })
  @ApiForbiddenResponse({ description: 'Permissions insuffisantes' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' },
  ) {
    return this.tenantsService.updateStatus(id, body.status);
  }

  @Patch(':id/database')
  @ApiOperation({
    summary: 'Mettre à jour la connexion base de données',
    description: `
      Met à jour les informations de connexion à la base de données d'un tenant.
      Utilisé par le système de provisioning.
      
      **Note :** En production, seul \`secretRef\` est utilisé pour la sécurité.
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Identifiant du tenant',
    example: 'cm123abc456def789',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        dbUrl: {
          type: 'string',
          description: 'URL de connexion (développement uniquement)',
          example: 'postgresql://user:pass@localhost:5432/tenant_db',
        },
        secretRef: {
          type: 'string',
          description: 'Référence AWS Secrets Manager (production)',
          example:
            'arn:aws:secretsmanager:eu-west-1:123:secret:helpdeskly-tenant-db',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Connexion base de données mise à jour',
    schema: {
      example: {
        id: 'cm123abc456def789',
        slug: 'ma-entreprise',
        status: 'ACTIVE',
        updatedAt: '2023-12-01T10:30:00.000Z',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Tenant non trouvé' })
  @ApiForbiddenResponse({ description: 'Permissions insuffisantes' })
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
}
