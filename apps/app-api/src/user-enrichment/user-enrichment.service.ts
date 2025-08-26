import { Injectable, Logger } from '@nestjs/common';
import { ControlPrismaService } from '../prisma/control-prisma.service';
import { TenantPrismaService } from '../services/tenant-prisma.service';

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role?: string;
  permissions?: string[];
}

interface EnrichableEntity {
  authorId?: string | null;
  assignedToId?: string | null;
  userId?: string | null;
  createdById?: string | null;
  updatedById?: string | null;
  [key: string]: any;
}

export interface EnrichedUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  permissions: string[];
  isActive: boolean;
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

    const allUserIds = entities.reduce((acc, entity) => {
      const userIds = this.extractUserIds(entity, userFields);
      userIds.forEach((id) => acc.add(id));
      return acc;
    }, new Set<string>());

    const users = await this.getUsersByIds(Array.from(allUserIds));
    const userMap = new Map(users.map((u) => [u.id, u]));

    return entities.map((entity) => {
      const enriched = { ...entity };

      for (const field of userFields) {
        const userId = entity[field];
        const userKey = this.getUserFieldName(field);
        (enriched as any)[userKey] = userId
          ? userMap.get(userId) || null
          : null;
      }

      return enriched as any;
    });
  }

  /**
   * Enrichit un utilisateur avec ses permissions pour un tenant
   */
  async enrichUserForTenant(
    userId: string,
    tenantId: string,
  ): Promise<EnrichedUser> {
    const user = await this.controlPrisma.user.findUnique({
      where: { id: userId, isActive: true },
      include: {
        memberships: {
          where: { tenantId, isActive: true },
          include: {
            tenant: {
              select: { status: true },
            },
          },
        },
      },
    });

    if (!user || user.memberships.length === 0) {
      throw new Error('User not found or not member of tenant');
    }

    const membership = user.memberships[0];

    if (membership.tenant.status !== 'ACTIVE') {
      throw new Error('Tenant is not active');
    }

    const permissions = this.getPermissionsForRole(membership.role);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar ?? undefined,
      role: String(membership.role),
      permissions,
      isActive: user.isActive,
    };
  }

  /**
   * Enrichit plusieurs utilisateurs avec leurs permissions
   */
  async enrichMultipleUsers(
    userIds: string[],
    tenantId: string,
  ): Promise<Record<string, EnrichedUser>> {
    const users = await this.controlPrisma.user.findMany({
      where: {
        id: { in: userIds },
        isActive: true,
        memberships: {
          some: { tenantId, isActive: true },
        },
      },
      include: {
        memberships: {
          where: { tenantId, isActive: true },
        },
      },
    });

    const enrichedUsers: Record<string, EnrichedUser> = {};

    for (const user of users) {
      const membership = user.memberships[0];
      if (membership) {
        enrichedUsers[user.id] = {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar ?? undefined,
          role: String(membership.role),
          permissions: this.getPermissionsForRole(membership.role),
          isActive: user.isActive,
        };
      }
    }

    return enrichedUsers;
  }

  /**
   * Validation qu'un utilisateur appartient au tenant courant
   */
  async validateUserMembership(
    userId: string | null | undefined,
  ): Promise<boolean> {
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

  /**
   * Vérifie si un utilisateur a une permission spécifique
   */
  async hasPermission(
    userId: string,
    tenantId: string,
    permission: string,
  ): Promise<boolean> {
    try {
      const enrichedUser = await this.enrichUserForTenant(userId, tenantId);
      return (
        enrichedUser.permissions.includes('*') ||
        enrichedUser.permissions.includes(permission)
      );
    } catch {
      return false;
    }
  }

  /**
   * Retourne les permissions pour un rôle donné
   */
  getPermissionsForRole(role: string): string[] {
    const rolePermissions = {
      OWNER: ['*'],
      ADMIN: [
        'ticket.create',
        'ticket.read',
        'ticket.update',
        'ticket.delete',
        'ticket.assign',
        'comment.create',
        'comment.read',
        'comment.update',
        'comment.delete',
        'user.read',
        'user.invite',
      ],
      MEMBER: [
        'ticket.create',
        'ticket.read',
        'ticket.update.own',
        'comment.create',
        'comment.read',
        'comment.update.own',
      ],
      VIEWER: ['ticket.read', 'comment.read'],
    };

    return rolePermissions[role] || ['ticket.read'];
  }

  // === MÉTHODES PRIVÉES ===

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

    let freshUsers: UserInfo[] = [];
    if (uncachedIds.length > 0) {
      freshUsers = await this.controlPrisma.user.findMany({
        where: { id: { in: uncachedIds } },
        select: { id: true, name: true, email: true, avatar: true },
      });

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
