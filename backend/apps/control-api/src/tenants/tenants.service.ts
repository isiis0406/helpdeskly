import { PrismaClient as ControlPrismaClient } from '.prisma/control';
import { InjectQueue } from '@nestjs/bullmq';
import * as bcrypt from 'bcrypt';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { addDays } from 'date-fns';
import { AuthService } from 'src/auth/auth.service';
import { BILLING_CONFIG } from '../billing/config/plans.config';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantSignupDto } from './dto/tenant-signup.dto';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: ControlPrismaClient,
    private readonly config: ConfigService,
    private readonly authService: AuthService,

    @InjectQueue('provisioning') private readonly queue: Queue,
  ) {}

  async createTenant(dto: CreateTenantDto, includeDemoData: boolean = false) {
    // 🔧 Ces logs DOIVENT apparaître
    console.log('🚀 === SERVICE CALLED ===');
    console.log('🔧 Method createTenant called with:', dto);

    this.logger.log('createTenant method called');
    this.logger.debug('DTO received:', JSON.stringify(dto, null, 2));

    const trialDays = dto.trialDays ?? 14;

    // Validation du slug
    await this.validateUniqueSlug(dto.slug);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.tenantName,
        slug: dto.slug.toLowerCase(),

        // Logique hybride selon l'environnement
        dbUrl: this.isProduction()
          ? null
          : this.generateDevDatabaseUrl(dto.slug),
        secretRef: this.isProduction()
          ? this.generateSecretRef(dto.slug)
          : null,

        status: 'PROVISIONING',
        trialEndsAt: addDays(new Date(), trialDays),
        schemaVersion: 1,
      },
    });

    // Lancement du provisioning asynchrone
    await this.queue.add('provision-tenant', {
      tenantId: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      includeDemoData,
    });

    this.logger.log(`Tenant created: ${tenant.slug} (${tenant.id})`);

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      url: this.generateTenantUrl(tenant.slug), // 🔧 URL sécurisée
      trialEndsAt: tenant.trialEndsAt,
    };
  }

  /**
   * ✅ NOUVELLE: Inscription SaaS complète (tenant + admin + auth)
   * Réutilise createTenant() + ajoute création admin
   */
  async signupTenant(
    signupDto: TenantSignupDto,
    metadata: { ip: string; userAgent: string },
  ) {
    const {
      adminName,
      adminEmail,
      adminPassword,
      acceptTerms,
      ...tenantData // ✅ Réutilise toutes les données de CreateTenantDto
    } = signupDto;

    // Validations préliminaires
    if (!acceptTerms) {
      throw new BadRequestException('Terms acceptance required');
    }

    // Vérifier que l'email admin n'existe pas
    const existingUser = await this.prisma.user.findUnique({
      where: { email: adminEmail },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // ✅ RÉUTILISER: Créer le tenant avec la logique existante
    const tenant = await this.createTenant(
      tenantData,
      !!signupDto.withDemoData,
    );

    // Transaction pour créer l'admin et le membership
    const admin = await this.prisma.$transaction(async (tx) => {
      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(adminPassword, 12);

      // Créer l'utilisateur admin
      const user = await tx.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: adminName,
          isActive: true,
          //  emailVerified: true, // Auto-vérifié pour simplifier l'onboarding
        },
      });

      // Créer le membership OWNER
      await tx.membership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          role: 'OWNER',
          isActive: true,
        },
      });

      return user;
    });

    // ✅ Créer une subscription par défaut (plan free) si disponible
    await this.ensureDefaultSubscription(tenant.id);

    // ✅ Générer les tokens d'authentification
    const tokens = await this.authService.generateTokens(
      admin.id,
      tenant.id, // currentTenantId
      metadata, // securityContext
    );

    // Enregistrer la session
    await this.authService.createSession(
      admin.id,
      tenant.id,
      metadata.userAgent,
      metadata.ip,
    );

    // TODO: Email de bienvenue (async)
    // this.emailService.sendWelcomeEmail(admin.email, { ... });

    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        trialEndsAt: tenant.trialEndsAt,
        url: tenant.url,
      },
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'OWNER',
      },
      tokens,
      onboarding: {
        nextSteps: [
          'Personnaliser votre workspace',
          'Inviter votre équipe',
          'Configurer les catégories de tickets',
        ],
      },
    };
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        trialEndsAt: true,
        createdAt: true,
        updatedAt: true,
        // 🔒 SÉCURITÉ : Exclusion des champs sensibles (dbUrl, secretRef)
        memberships: {
          select: {
            id: true,
            role: true,
            isActive: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                // 🔒 JAMAIS de password ici !
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Récupère les tenants d'un utilisateur spécifique
   */
  async findTenantsForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            trialEndsAt: true,
            createdAt: true,
            updatedAt: true,
            // Exclure les infos sensibles comme dbUrl
          },
        },
      },
    });

    return memberships.map((membership) => ({
      ...membership.tenant,
      role: membership.role, // Ajouter le rôle de l'utilisateur
      memberSince: membership.createdAt,
    }));
  }

  /**
   * Vérifie si un utilisateur peut accéder à un tenant
   */
  async canUserAccessTenant(
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        tenantId,
        isActive: true,
      },
    });

    return !!membership;
  }

  /**
   * Vérifie si un utilisateur peut gérer un tenant
   */
  async canUserManageTenant(
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        tenantId,
        isActive: true,
        role: {
          in: ['OWNER', 'ADMIN'],
        },
      },
    });

    return !!membership;
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        trialEndsAt: true,
        schemaVersion: true,
        createdAt: true,
        updatedAt: true,
        // 🔒 Exclusion des URLs sensibles
        memberships: {
          select: {
            id: true,
            role: true,
            isActive: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new Error(`Tenant with ID ${id} not found`);
    }

    return tenant;
  }

  async findBySlug(slug: string) {
    return this.prisma.tenant.findUnique({
      where: { slug: slug.toLowerCase() },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        // 🔒 Inclusion sécurisée pour résolution interne
        dbUrl: true, // Nécessaire pour la connexion
        secretRef: true, // Nécessaire pour la connexion
        memberships: {
          where: { isActive: true },
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    return this.prisma.tenant.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        slug: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async updateDatabaseConnection(
    id: string,
    dbUrl?: string,
    secretRef?: string,
  ) {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        dbUrl: this.isProduction() ? null : dbUrl,
        secretRef: this.isProduction() ? secretRef : null,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        slug: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  private async ensureDefaultSubscription(tenantId: string) {
    try {
      const existing = await this.prisma.subscription.findUnique({ where: { tenantId } });
      if (existing) return existing;

      const defaultPlanId = BILLING_CONFIG.DEFAULT_PLAN_ID || 'free';
      const plan = await this.prisma.plan.findUnique({ where: { id: defaultPlanId } });
      if (!plan) {
        this.logger.warn(`Default plan '${defaultPlanId}' not found. Skipping default subscription creation.`);
        return null;
      }

      const sub = await this.prisma.subscription.create({
        data: {
          tenantId,
          planId: plan.id,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          amount: '0',
          currency: plan.currency || 'EUR',
          startDate: new Date(),
        },
      });

      this.logger.log(`Default subscription created for tenant ${tenantId} on plan '${plan.id}'.`);
      return sub;
    } catch (e) {
      this.logger.error('Failed to create default subscription', e as any);
      return null;
    }
  }

  // 🔧 Méthode sécurisée pour générer l'URL tenant
  private generateTenantUrl(slug: string): string {
    const baseDomain = this.config.get<string>('BASE_DOMAIN');
    const protocol = this.isProduction() ? 'https' : 'http';

    if (!baseDomain || baseDomain === 'localhost:3000') {
      // En dev local
      return `${protocol}://localhost:3000?tenant=${slug}`;
    }

    // En production avec domaine personnalisé
    return `${protocol}://${slug}.${baseDomain}`;
  }

  // Méthodes privées inchangées...
  private async validateUniqueSlug(slug: string): Promise<void> {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true }, // Sélection minimale pour validation
    });

    if (existing) {
      throw new ConflictException(`Tenant with slug '${slug}' already exists`);
    }

    // Validation du format
    if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 2 || slug.length > 50) {
      throw new BadRequestException(
        'Invalid slug format. Use only lowercase letters, numbers, and hyphens.',
      );
    }

    // Slugs réservés
    const reservedSlugs = [
      'api',
      'www',
      'admin',
      'app',
      'mail',
      'ftp',
      'dashboard',
      'portal',
      'support',
      'help',
      'docs',
    ];

    if (reservedSlugs.includes(slug.toLowerCase())) {
      throw new BadRequestException(`Slug '${slug}' is reserved`);
    }
  }

  private isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private generateDevDatabaseUrl(slug: string): string {
    const baseUrl = this.config.get<string>(
      'DATABASE_URL',
      'postgresql://root:root@localhost:5436/postgres',
    );
    return baseUrl.replace('/postgres', `/${slug}_db`);
  }

  private generateSecretRef(slug: string): string {
    const region = this.config.get<string>('AWS_REGION', 'eu-west-1');
    return `arn:aws:secretsmanager:${region}:${this.config.get<string>('AWS_ACCOUNT_ID')}:secret:helpdeskly-${slug}-db`;
  }
}
