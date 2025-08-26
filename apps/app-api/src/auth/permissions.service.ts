import { Injectable } from '@nestjs/common';

export interface UserWithPermissions {
  id: string;
  permissions: string[];
  role: string;
}

@Injectable()
export class PermissionsService {
  /**
   * Définition des permissions par rôle
   */
  private readonly rolePermissions = {
    OWNER: ['*'], // Toutes les permissions
    ADMIN: [
      'ticket.*',
      'comment.*',
      'user.read',
      'user.invite',
      'user.manage',
      'tenant.settings.read',
    ],
    MEMBER: [
      'ticket.create',
      'ticket.read',
      'ticket.update.own',
      'ticket.assign.own',
      'comment.create',
      'comment.read',
      'comment.update.own',
      'comment.delete.own',
    ],
    VIEWER: ['ticket.read', 'comment.read'],
  };

  /**
   * Retourne les permissions pour un rôle donné
   */
  getPermissionsForRole(role: string): string[] {
    return this.rolePermissions[role] || this.rolePermissions.VIEWER;
  }

  /**
   * Vérifie si un utilisateur a une permission spécifique
   */
  hasPermission(user: UserWithPermissions, permission: string): boolean {
    if (user.permissions.includes('*')) {
      return true;
    }

    return this.checkPermission(user.permissions, permission);
  }

  /**
   * Vérifie si un utilisateur a toutes les permissions requises
   */
  hasAllPermissions(user: UserWithPermissions, permissions: string[]): boolean {
    return permissions.every((permission) =>
      this.hasPermission(user, permission),
    );
  }

  /**
   * Vérifie si un utilisateur a au moins une des permissions
   */
  hasAnyPermission(user: UserWithPermissions, permissions: string[]): boolean {
    return permissions.some((permission) =>
      this.hasPermission(user, permission),
    );
  }

  /**
   * Filtre les actions autorisées pour un utilisateur
   */
  getAuthorizedActions(
    user: UserWithPermissions,
    availableActions: string[],
  ): string[] {
    return availableActions.filter((action) =>
      this.hasPermission(user, action),
    );
  }

  /**
   * Vérifie les permissions sur une ressource spécifique
   */
  canAccessResource(
    user: UserWithPermissions,
    resource: { authorId?: string; assignedToId?: string },
    action: string,
  ): boolean {
    // Permission globale
    if (this.hasPermission(user, action)) {
      return true;
    }

    // Permission sur ses propres ressources
    if (this.hasPermission(user, `${action}.own`)) {
      return resource.authorId === user.id || resource.assignedToId === user.id;
    }

    return false;
  }

  /**
   * Logique interne de vérification des permissions avec wildcards
   */
  private checkPermission(
    userPermissions: string[],
    requiredPermission: string,
  ): boolean {
    // Permission exacte
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // Vérifier les wildcards
    const parts = requiredPermission.split('.');

    for (let i = parts.length - 1; i > 0; i--) {
      const wildcardPermission = parts.slice(0, i).join('.') + '.*';
      if (userPermissions.includes(wildcardPermission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Valide et normalise les permissions
   */
  validatePermissions(permissions: string[]): string[] {
    const validPermissions = new Set<string>();

    for (const permission of permissions) {
      if (this.isValidPermission(permission)) {
        validPermissions.add(permission);
      }
    }

    return Array.from(validPermissions);
  }

  /**
   * Vérifie si une permission est valide
   */
  private isValidPermission(permission: string): boolean {
    if (permission === '*') return true;

    const validPatterns = [
      /^ticket\.(create|read|update|delete|assign)(\.(own|assigned))?$/,
      /^comment\.(create|read|update|delete)(\.(own))?$/,
      /^user\.(read|invite|manage|delete)$/,
      /^tenant\.(settings\.(read|write)|members\.(read|invite|remove))$/,
    ];

    return validPatterns.some((pattern) => pattern.test(permission));
  }
}
