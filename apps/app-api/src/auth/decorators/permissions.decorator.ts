import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Décorateur pour définir les permissions requises sur une route
 * Supporte plusieurs permissions (OR logique)
 *
 * @example
 * @Permissions('ticket.read')
 * @Permissions('ticket.read', 'ticket.read.own')
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
/**
 * Décorateur pour définir les permissions requises sur une route
 * Supporte plusieurs permissions (OR logique)
 *
 * @example
 * @Permissions('ticket.read')
 * @Permissions('ticket.read', 'ticket.read.own')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Décorateur pour les routes publiques (pas de permissions requises)
 */
export const PublicRoute = () => SetMetadata('isPublic', true);

/**
 * Décorateur pour les routes qui nécessitent toutes les permissions (AND logique)
 */
export const RequireAllPermissions = (...permissions: string[]) =>
  SetMetadata('requireAll', permissions);
