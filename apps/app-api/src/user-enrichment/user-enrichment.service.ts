// apps/app-api/src/services/user-enrichment.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { TenantPrismaService } from 'src/services/tenant-prisma.service';
import { ControlPrismaService } from '../prisma/control-prisma.service';

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

// 🔧 CORRECTION : Interface mise à jour pour gérer null ET undefined
interface EnrichableEntity {
  authorId?: string | null;
  assignedToId?: string | null;
  userId?: string | null;
  createdById?: string | null;
  updatedById?: string | null;
  [key: string]: any;
}

@Injectable()
export class UserEnrichmentService {
  private readonly logger = new Logger(UserEnrichmentService.name);
  private readonly userCache = new Map<string, UserInfo>();
  private readonly cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly controlPrisma: ControlPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  /**
   * Enrichit une entité unique avec les données utilisateur
   */
  async enrichEntity<T extends EnrichableEntity>(
    entity: T,
    userFields: string[] = ['authorId', 'assignedToId'],
  ): Promise<T & { [K in string]: UserInfo | null }> {
    if (!entity) return entity as any;

    const userIds = this.extractUserIds(entity, userFields);
    const users = await this.getUsersByIds(userIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enriched = { ...entity };

    for (const field of userFields) {
      const userId = entity[field];
      const userKey = this.getUserFieldName(field);
      // 🔧 CORRECTION : Gestion explicite de null et undefined
      (enriched as any)[userKey] = userId ? userMap.get(userId) || null : null;
    }

    return enriched as any;
  }

  /**
   * Enrichit un tableau d'entités avec les données utilisateur
   */
  async enrichEntities<T extends EnrichableEntity>(
    entities: T[],
    userFields: string[] = ['authorId', 'assignedToId'],
  ): Promise<Array<T & { [K in string]: UserInfo | null }>> {
    if (!entities.length) return [];

    // Collecte de tous les IDs utilisateur uniques
    const allUserIds = entities.reduce((acc, entity) => {
      const userIds = this.extractUserIds(entity, userFields);
      userIds.forEach((id) => acc.add(id));
      return acc;
    }, new Set<string>());

    // Une seule requête pour tous les utilisateurs
    const users = await this.getUsersByIds(Array.from(allUserIds));
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Enrichissement de toutes les entités
    return entities.map((entity) => {
      const enriched = { ...entity };

      for (const field of userFields) {
        const userId = entity[field];
        const userKey = this.getUserFieldName(field);
        // 🔧 CORRECTION : Gestion explicite de null et undefined
        (enriched as any)[userKey] = userId
          ? userMap.get(userId) || null
          : null;
      }

      return enriched as any;
    });
  }

  /**
   * Validation qu'un utilisateur appartient au tenant courant
   */
  async validateUserMembership(
    userId: string | null | undefined,
  ): Promise<boolean> {
    // 🔧 CORRECTION : Gestion des valeurs falsy
    if (!userId) return false;

    const tenant = this.tenantPrisma.getTenantInfo();

    const membership = await this.controlPrisma.membership.findFirst({
      where: {
        userId,
        tenantId: tenant.id,
        isActive: true,
      },
    });

    return !!membership;
  }

  /**
   * Validation de plusieurs utilisateurs
   */
  async validateUsersMembership(
    userIds: (string | null | undefined)[],
  ): Promise<{ [userId: string]: boolean }> {
    // 🔧 CORRECTION : Filtrage des valeurs falsy
    const validUserIds = userIds.filter((id): id is string => Boolean(id));

    if (!validUserIds.length) return {};

    const tenant = this.tenantPrisma.getTenantInfo();

    const memberships = await this.controlPrisma.membership.findMany({
      where: {
        userId: { in: validUserIds },
        tenantId: tenant.id,
        isActive: true,
      },
      select: { userId: true },
    });

    const validMemberIds = new Set(memberships.map((m) => m.userId));

    return validUserIds.reduce(
      (acc, userId) => {
        acc[userId] = validMemberIds.has(userId);
        return acc;
      },
      {} as { [userId: string]: boolean },
    );
  }

  // === MÉTHODES PRIVÉES ===

  // 🔧 CORRECTION : Méthode mise à jour pour gérer null
  private extractUserIds(entity: EnrichableEntity, fields: string[]): string[] {
    return fields
      .map((field) => entity[field])
      .filter((id): id is string => Boolean(id) && typeof id === 'string');
  }

  private getUserFieldName(field: string): string {
    const fieldMap: { [key: string]: string } = {
      authorId: 'author',
      assignedToId: 'assignedTo',
      userId: 'user',
      createdById: 'createdBy',
      updatedById: 'updatedBy',
    };
    return fieldMap[field] || field.replace(/Id$/, '');
  }

  private async getUsersByIds(userIds: string[]): Promise<UserInfo[]> {
    if (!userIds.length) return [];

    // Vérification du cache
    const now = Date.now();
    const cachedUsers: UserInfo[] = [];
    const uncachedIds: string[] = [];

    for (const id of userIds) {
      const cached = this.userCache.get(id);
      const expiry = this.cacheExpiry.get(id);

      if (cached && expiry && expiry > now) {
        cachedUsers.push(cached);
      } else {
        uncachedIds.push(id);
      }
    }

    // Requête pour les utilisateurs non cachés
    let freshUsers: UserInfo[] = [];
    if (uncachedIds.length > 0) {
      freshUsers = await this.controlPrisma.user.findMany({
        where: { id: { in: uncachedIds } },
        select: { id: true, name: true, email: true, avatar: true },
      });

      // Mise en cache
      const expiry = now + this.CACHE_TTL;
      freshUsers.forEach((user) => {
        this.userCache.set(user.id, user);
        this.cacheExpiry.set(user.id, expiry);
      });
    }

    return [...cachedUsers, ...freshUsers];
  }

  /**
   * Nettoie le cache expiré
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [id, expiry] of this.cacheExpiry.entries()) {
      if (expiry <= now) {
        this.userCache.delete(id);
        this.cacheExpiry.delete(id);
      }
    }
  }
}
