# 🏗️ Guide Complet : Architecture Multi-Tenant SaaS avec NestJS

## 📋 Vue d'ensemble

Cette application **Helpdeskly** implémente une architecture **multi-tenant** avec le pattern **"Database-per-Tenant"** utilisant **NestJS**, **Prisma**, et **PostgreSQL**. Chaque client (tenant) possède sa propre base de données dédiée, garantissant l'isolation complète des données.

---

## 🎯 Concepts Clés

### **Multi-Tenancy Pattern : Database-per-Tenant**

- **1 base de données de contrôle** : Gère les métadonnées des tenants
- **N bases de données tenant** : Une base dédiée par client
- **Isolation totale** : Aucun risque de fuite de données entre clients
- **Scalabilité** : Chaque tenant peut évoluer indépendamment

### **Architecture en Microservices**

```
Control API (Port 3001) ─── Gestion des tenants, provisioning
    │
    └── Base de contrôle (metadata)

App API (Port 3000) ─────── Application métier multi-tenant
    │
    └── Bases tenant individuelles
```

---

## 🗂️ Structure du Projet

```
helpdeskly/
├── 📁 apps/
│   ├── 📁 control-api/          # API de gestion des tenants
│   └── 📁 app-api/              # API applicative multi-tenant
├── 📁 prisma/
│   ├── 📁 control/              # Schéma base de contrôle
│   └── 📁 tenant/               # Schéma base tenant
├── 📁 pgadmin/                  # Configuration PgAdmin
├── 🐳 docker-compose.yml       # Infrastructure complète
└── 📄 package.json             # Workspace monorepo
```

---

## 🎮 Control API - Gestion des Tenants

### **Rôle**

Gère le cycle de vie des tenants : création, activation, désactivation, provisioning des bases de données.

### **Base de données de contrôle**

```prisma
// prisma/control/schema.prisma
model Tenant {
  id        String       @id @default(cuid())
  name      String       // Nom commercial du client
  slug      String       @unique // Identifiant unique (ex: "acme-corp")
  dbUrl     String       // URL de connexion à la DB tenant
  status    TenantStatus @default(ACTIVE)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
}

enum TenantStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}
```

### **Services Clés**

#### **1. TenantService**

```typescript
// apps/control-api/src/tenants/tenants.service.ts
@Injectable()
export class TenantsService {
  // Création d'un nouveau tenant
  async create(createTenantDto: CreateTenantDto) {
    // 1. Validation du slug (unique, format)
    // 2. Création de la DB dédiée
    // 3. Exécution des migrations
    // 4. Enregistrement en base de contrôle
  }

  // Provisioning asynchrone via BullMQ
  async provision(tenantId: string) {
    // Job queue pour création DB + migrations
  }
}
```

#### **2. ProvisioningProcessor**

```typescript
// apps/control-api/src/provisioning/provisioning.processor.ts
@Processor("tenant-provisioning")
export class ProvisioningProcessor {
  @Process("create-database")
  async createDatabase(job: Job) {
    // 1. Création physique de la DB PostgreSQL
    // 2. Génération URL de connexion
    // 3. Exécution migrations Prisma
    // 4. Validation de la structure
  }
}
```

---

## 🚀 App API - Application Multi-Tenant

### **Rôle**

Sert l'application métier avec résolution automatique du tenant et connexion à la bonne base de données.

### **Base de données tenant**

```prisma
// prisma/tenant/schema.prisma
model Ticket {
  id           String        @id @default(cuid())
  title        String
  description  String
  status       TicketStatus  @default(OPEN)
  priority     TicketPriority @default(MEDIUM)
  authorId     String
  assignedToId String?

  // Relations
  author       User          @relation("TicketAuthor", fields: [authorId], references: [id])
  assignedTo   User?         @relation("TicketAssignee", fields: [assignedToId], references: [id])
  comments     Comment[]

  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String
  role            UserRole

  // Relations inverses
  tickets         Ticket[]  @relation("TicketAuthor")
  assignedTickets Ticket[]  @relation("TicketAssignee")
  comments        Comment[]
}

model Comment {
  id       String   @id @default(cuid())
  body     String
  ticketId String
  authorId String

  // Relations
  ticket   Ticket   @relation(fields: [ticketId], references: [id])
  author   User     @relation(fields: [authorId], references: [id])

  createdAt DateTime @default(now())
}
```

### **Résolution du Tenant**

#### **1. TenantContextMiddleware**

```typescript
// apps/app-api/src/middleware/tenant-context.middleware.ts
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      // 1. Extraction du slug depuis header ou sous-domaine
      const slug = req.headers["x-tenant-slug"] || req.hostname.split(".")[0];

      // 2. Validation sécurisée du slug
      const validatedSlug = this.validateTenantSlug(slug);

      // 3. Recherche du tenant en base de contrôle
      const tenant = await this.controlPrisma.tenant.findUnique({
        where: { slug: validatedSlug },
      });

      // 4. Vérification statut actif
      if (!tenant || tenant.status !== "ACTIVE") {
        throw new ForbiddenException("Tenant not found or inactive");
      }

      // 5. Injection du contexte tenant dans la requête
      req.tenant = {
        id: tenant.id,
        slug: tenant.slug,
        prisma: await this.tenantFactory.getClient(tenant.id, tenant.dbUrl),
      };

      next();
    } catch (error) {
      next(error);
    }
  }
}
```

#### **2. TenantClientFactory**

```typescript
// apps/app-api/src/prisma/tenant-prisma.factory.ts
@Injectable()
export class TenantClientFactory implements OnModuleDestroy {
  private readonly cache = new Map<string, CachedTenantClient>();
  private readonly maxConnectionsPerTenant = 5;
  private readonly maxTotalConnections = 100;

  async getClient(tenantId: string, dbUrl: string): Promise<PrismaClient> {
    // 1. Vérification des limites de connexion
    this.checkConnectionLimits(tenantId);

    // 2. Retour du client en cache si disponible
    const cached = this.cache.get(tenantId);
    if (cached) {
      cached.lastAccessed = Date.now();
      return cached.client;
    }

    // 3. Création nouveau client avec gestion d'erreurs
    return this.createNewClient(tenantId, dbUrl);
  }

  private async createNewClient(
    tenantId: string,
    dbUrl: string
  ): Promise<PrismaClient> {
    const client = new PrismaClient({
      datasources: { db: { url: dbUrl } },
      log: ["error", "warn"],
    });

    // Test de connexion
    await client.$connect();

    // Mise en cache avec métadonnées
    this.cache.set(tenantId, {
      client,
      lastAccessed: Date.now(),
      connectionCount: 1,
    });

    return client;
  }
}
```

### **Services Métier**

#### **TicketsService**

```typescript
// apps/app-api/src/ticket/ticket.service.ts
@Injectable()
export class TicketsService {
  list(req: Request) {
    // Utilisation automatique de la DB tenant résolue
    return req.tenant!.prisma.ticket.findMany({
      include: {
        author: true,
        assignedTo: true,
        comments: { include: { author: true } },
      },
    });
  }

  create(req: Request, dto: CreateTicketDto) {
    return req.tenant!.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        authorId: dto.authorId,
        assignedToId: dto.assignedToId,
        priority: dto.priority || "MEDIUM",
        status: dto.status || "OPEN",
      },
      include: {
        author: true,
        assignedTo: true,
      },
    });
  }
}
```

---

## 🔧 Configuration et Infrastructure

### **Docker Compose**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: root

  pgbouncer:
    image: edoburu/pgbouncer
    ports: ["6432:6432"]
    # Pool de connexions pour optimiser les performances

  redis:
    image: redis:7
    ports: ["6379:6379"]
    # Queue BullMQ pour provisioning asynchrone

  pgadmin:
    image: dpage/pgadmin4:8
    ports: ["5050:80"]
    # Interface d'administration des bases
```

### **Workspace MonoRepo**

```json
// package.json
{
  "workspaces": ["apps/*", "libs/*"],
  "scripts": {
    "dev:control": "pnpm --filter control-api start:dev",
    "dev:app": "pnpm --filter app-api start:dev",
    "dev": "concurrently \"pnpm dev:control\" \"pnpm dev:app\""
  }
}
```

---

## 🛡️ Sécurité et Validation

### **Validation des Slugs**

```typescript
private validateTenantSlug(slug: string): string {
  if (!slug || typeof slug !== 'string') {
    throw new ForbiddenException('Tenant slug is required');
  }

  // Format strict : lettres minuscules, chiffres, tirets
  if (!/^[a-z0-9-]+$/.test(slug) || slug.length > 50) {
    throw new ForbiddenException('Invalid tenant slug format');
  }

  // Blacklist des slugs réservés
  const reserved = ['api', 'www', 'admin', 'app'];
  if (reserved.includes(slug)) {
    throw new ForbiddenException('Reserved slug');
  }

  return slug.toLowerCase();
}
```

### **Exceptions Personnalisées**

```typescript
// apps/app-api/src/common/exceptions/tenant.exceptions.ts
export class TenantNotFoundException extends HttpException {
  constructor() {
    super("Tenant not found", HttpStatus.NOT_FOUND);
  }
}

export class TenantInactiveException extends HttpException {
  constructor() {
    super("Tenant is inactive", HttpStatus.FORBIDDEN);
  }
}

export class TenantConnectionLimitException extends HttpException {
  constructor() {
    super("Connection limit reached", HttpStatus.TOO_MANY_REQUESTS);
  }
}
```

---

## 🔄 Flux de Données Complet

### **1. Création d'un Tenant**

```
Client → Control API → TenantService → ProvisioningQueue
                                    ↓
PostgreSQL ← Migrations ← Database Creation ← BullMQ Job
    ↓
Tenant DB créée → Enregistrement en base de contrôle
```

### **2. Requête Application**

```
Client Request → App API → TenantMiddleware
                              ↓
                    Slug Validation → Control DB Query
                              ↓
                    Tenant Found → Factory.getClient()
                              ↓
                    Tenant DB Connection → Business Logic
                              ↓
                    Response ← Data Processing ← Tenant Data
```

---

## 🚀 Patterns de Développement

### **DTOs avec Validation**

```typescript
// create-ticket.dto.ts
export class CreateTicketDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  description!: string;

  @IsString()
  @IsUUID()
  authorId!: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}
```

### **Type Safety avec Prisma**

```typescript
// Types automatiquement générés
type TicketWithRelations = Prisma.TicketGetPayload<{
  include: {
    author: true;
    assignedTo: true;
    comments: { include: { author: true } };
  };
}>;
```

---

## 📊 Monitoring et Métriques

### **Connection Pool Monitoring**

```typescript
interface TenantMetrics {
  totalConnections: number;
  activeClients: number;
  connectionsByTenant: Map<string, number>;
}

getMetrics(): TenantMetrics {
  return {
    totalConnections: this.totalConnections,
    activeClients: this.cache.size,
    connectionsByTenant: new Map(
      Array.from(this.cache.entries()).map(([id, cached]) =>
        [id, cached.connectionCount]
      )
    )
  };
}
```

### **Health Checks**

```typescript
private async performHealthChecks(): void {
  for (const [tenantId, cached] of this.cache.entries()) {
    try {
      await cached.client.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.warn(`Health check failed for tenant ${tenantId}`);
      await this.removeClient(tenantId);
    }
  }
}
```

---

## 🎯 Points Clés pour Réplication

### **1. Isolation Totale**

- Chaque tenant = base de données séparée
- Aucun partage de données possible
- Migrations indépendantes par tenant

### **2. Résolution Dynamique**

- Middleware intercepte toutes les requêtes
- Slug du tenant extrait depuis header/sous-domaine
- Client Prisma résolu dynamiquement

### **3. Performance**

- Pool de connexions par tenant avec limites
- Cache en mémoire avec expiration
- Health checks automatiques

### **4. Scalabilité**

- Provisioning asynchrone via queues
- Connection pooling avec PgBouncer
- Monitoring des métriques de performance

### **5. Sécurité**

- Validation stricte des slugs
- Blacklist des mots réservés
- Gestion d'erreurs robuste

---

## 🚀 Commandes de Démarrage

```bash
# Infrastructure
docker compose up -d

# Bases de données
pnpm exec prisma migrate dev --schema=prisma/control/schema.prisma
pnpm exec prisma generate --schema=prisma/control/schema.prisma
pnpm exec prisma generate --schema=prisma/tenant/schema.prisma

# Applications
pnpm dev:control  # Port 3001
pnpm dev:app      # Port 3000
```

---

## 📋 Checklist d'Implémentation

- [ ] **Infrastructure** : Docker, PostgreSQL, Redis
- [ ] **Schémas Prisma** : Control + Tenant
- [ ] **Control API** : Gestion tenants + Provisioning
- [ ] **App API** : Middleware résolution + Factory connexions
- [ ] **Sécurité** : Validation slugs + Exceptions
- [ ] **Performance** : Pool connexions + Cache + Health checks
- [ ] **Monitoring** : Métriques + Logs + Alertes

Cette architecture garantit une **isolation complète**, une **scalabilité horizontale** et une **sécurité robuste** pour votre SaaS multi-tenant. 🎯
