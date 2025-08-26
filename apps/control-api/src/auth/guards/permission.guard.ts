import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
} from '../decortors/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Vérifier les rôles globaux requis
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles && requiredRoles.length > 0) {
      if (requiredRoles.includes('SUPER_ADMIN') && !this.isSuperAdmin(user)) {
        this.logger.warn(
          `Access denied: User ${user.sub} is not a super admin`,
        );
        throw new ForbiddenException('Super admin access required');
      }
    }

    // Vérifier les permissions spécifiques
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPermission = this.checkUserPermissions(
        user,
        requiredPermissions,
      );

      if (!hasPermission) {
        this.logger.warn(
          `Access denied: User ${user.sub} lacks permissions: ${requiredPermissions.join(', ')}`,
        );
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return true;
  }

  private isSuperAdmin(user: any): boolean {
    return (
      user.email?.includes('@helpdeskly.com') || user.isSuperAdmin === true
    );
  }

  private checkUserPermissions(
    user: any,
    requiredPermissions: string[],
  ): boolean {
    // Super admin a tous les droits
    if (this.isSuperAdmin(user)) {
      return true;
    }

    // Pour créer un tenant, tout utilisateur authentifié peut le faire
    if (requiredPermissions.includes('tenants.create')) {
      return true; // Tout utilisateur authentifié peut créer son tenant
    }

    // Vérifier si l'utilisateur a au moins un membership actif avec un rôle administratif
    const hasAdminMembership = user.memberships?.some(
      (membership: any) =>
        membership.isActive && ['OWNER', 'ADMIN'].includes(membership.role),
    );

    // Pour les permissions de lecture de base, un membership actif suffit
    if (
      requiredPermissions.includes('tenants.read') &&
      user.memberships?.length > 0
    ) {
      return true;
    }

    // Pour les permissions d'écriture, il faut un rôle administratif
    if (requiredPermissions.includes('tenants.write') && hasAdminMembership) {
      return true;
    }

    // Pour les permissions de gestion globale, seuls les super admins
    if (
      requiredPermissions.includes('tenants.manage') &&
      this.isSuperAdmin(user)
    ) {
      return true;
    }

    return false;
  }
}
