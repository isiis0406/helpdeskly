import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const ROLES_KEY = 'roles';
export const IS_PUBLIC_KEY = 'isPublic'; // ✅ Utiliser la même clé

/**
 * Décorateur pour définir les permissions requises
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Décorateur pour définir les rôles requis (global, pas par tenant)
 */
export const RequireRoles = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);

/**
 * Routes publiques (pas de token requis)
 * ✅ Utilise la même clé que jwt-auth.guard.ts
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
