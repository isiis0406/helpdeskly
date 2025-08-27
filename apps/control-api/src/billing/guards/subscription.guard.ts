import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SubscriptionService } from '../services/subscription.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenant?.id;

    if (!tenantId) {
      throw new ForbiddenException('Tenant ID required');
    }

    const subscription =
      await this.subscriptionService.getSubscriptionByTenant(tenantId);

    if (!subscription) {
      throw new ForbiddenException('Active subscription required');
    }

    if (
      subscription.status !== 'ACTIVE' &&
      subscription.status !== 'TRIALING'
    ) {
      throw new ForbiddenException(
        `Subscription status: ${subscription.status}`,
      );
    }

    // Ajouter les infos d'abonnement à la requête
    request.subscription = subscription;
    return true;
  }
}
