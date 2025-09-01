import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Vérifier si c'est une route publique
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Récupérer les permissions requises
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si aucune permission n'est définie, laisser passer
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userPermissions = user?.permissions || [];

    // Vérifier si l'utilisateur a au moins une des permissions requises (OR logique)
    const hasPermission = this.checkPermissions(
      userPermissions,
      requiredPermissions,
    );

    if (!hasPermission) {
      this.logger.warn(
        `Access denied for user ${user?.id} to ${request.method} ${request.url}. ` +
          `Required: [${requiredPermissions.join(', ')}], ` +
          `User has: [${userPermissions.join(', ')}]`,
      );

      throw new ForbiddenException(
        'Insufficient permissions to access this resource',
      );
    }

    // Vérifier les permissions "require all" si définies
    const requireAllPermissions = this.reflector.getAllAndOverride<string[]>(
      'requireAll',
      [context.getHandler(), context.getClass()],
    );

    if (requireAllPermissions && requireAllPermissions.length > 0) {
      const hasAllPermissions = requireAllPermissions.every((permission) =>
        this.hasSpecificPermission(userPermissions, permission),
      );

      if (!hasAllPermissions) {
        this.logger.warn(
          `User ${user?.id} missing required permissions: ${requireAllPermissions.join(', ')}`,
        );
        throw new ForbiddenException('Missing required permissions');
      }
    }

    return true;
  }

  /**
   * Vérifie si l'utilisateur a au moins une des permissions requises
   */
  private checkPermissions(
    userPermissions: string[],
    requiredPermissions: string[],
  ): boolean {
    // Super admin a tous les droits
    if (userPermissions.includes('*')) {
      return true;
    }

    // Vérifier chaque permission requise
    return requiredPermissions.some((permission) =>
      this.hasSpecificPermission(userPermissions, permission),
    );
  }

  /**
   * Vérifie si l'utilisateur a une permission spécifique
   * Supporte les wildcards comme "ticket.*"
   */
  private hasSpecificPermission(
    userPermissions: string[],
    requiredPermission: string,
  ): boolean {
    // Permission exacte
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // Vérifier les wildcards
    const permissionParts = requiredPermission.split('.');

    for (let i = permissionParts.length - 1; i > 0; i--) {
      const wildcardPermission = permissionParts.slice(0, i).join('.') + '.*';
      if (userPermissions.includes(wildcardPermission)) {
        return true;
      }
    }

    return false;
  }
}
