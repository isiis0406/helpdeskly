import { PrismaClient as ControlPrismaClient } from '.prisma/control';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { addDays } from 'date-fns';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: ControlPrismaClient,
    private readonly config: ConfigService,

    @InjectQueue('provisioning') private readonly queue: Queue,
  ) {}

  async createTenant(dto: CreateTenantDto) {
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
