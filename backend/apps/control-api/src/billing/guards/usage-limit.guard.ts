import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SubscriptionService } from '../services/subscription.service';

@Injectable()
export class UsageLimitGuard implements CanActivate {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.tenant?.id;

    if (!tenantId) {
      throw new ForbiddenException('Tenant ID required');
    }

    const limits = await this.subscriptionService.checkLimits(tenantId);
    if (!limits.withinLimits) {
      throw new ForbiddenException(
        `Usage limits exceeded: ${limits.violations.join(', ')}`,
      );
    }

    return true;
  }
}
