import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantGuard } from '../../tenant/guards/tenant.guard';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';
import { SubscriptionGuard } from '../guards/subscription.guard';
import { SubscriptionService } from '../services/subscription.service';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ════════════════════════════════════════════════════
  // 🆕 CRÉER UN ABONNEMENT
  // ════════════════════════════════════════════════════

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un nouvel abonnement',
    description: 'Crée un abonnement avec Stripe et initialise le tenant',
  })
  @ApiResponse({
    status: 201,
    description: 'Abonnement créé avec succès',
    schema: {
      example: {
        subscription: {
          id: 'sub_xxx',
          planId: 'plan_starter',
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          amount: 29.99,
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-02-01T00:00:00Z',
          plan: { name: 'Starter', features: [] },
          tenant: { id: 'tenant_xxx', name: 'Mon Entreprise' },
        },
        clientSecret: 'pi_xxx_secret_xxx',
        requiresPayment: true,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 409, description: 'Abonnement déjà existant' })
  async createSubscription(
    @CurrentTenant('id') tenantId: string,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ) {
    return this.subscriptionService.createSubscription({
      tenantId,
      ...createSubscriptionDto,
    });
  }

  // ════════════════════════════════════════════════════
  // 🔍 RÉCUPÉRER L'ABONNEMENT ACTUEL
  // ════════════════════════════════════════════════════

  @Get('current')
  @ApiOperation({
    summary: "Récupérer l'abonnement actuel du tenant",
    description: "Retourne les détails de l'abonnement avec plan et usage",
  })
  @ApiResponse({
    status: 200,
    description: 'Abonnement trouvé',
    schema: {
      example: {
        id: 'sub_xxx',
        status: 'ACTIVE',
        plan: { name: 'Pro', maxUsers: 50 },
        usage: { users: 12, tickets: 145 },
        nextBilling: '2024-02-01T00:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Aucun abonnement trouvé' })
  async getCurrentSubscription(@CurrentTenant('id') tenantId: string) {
    const subscription =
      await this.subscriptionService.getSubscriptionByTenant(tenantId);

    if (!subscription) {
      return { subscription: null, hasSubscription: false };
    }

    // Ajouter les informations d'usage
    const limits = await this.subscriptionService.checkLimits(tenantId);

    return {
      subscription,
      usage: limits.usage,
      limits: limits.limits,
      withinLimits: limits.withinLimits,
      violations: limits.violations,
      hasSubscription: true,
    };
  }

  // ════════════════════════════════════════════════════
  // 🔄 CHANGER DE PLAN
  // ════════════════════════════════════════════════════

  @Patch('plan')
  @ApiOperation({
    summary: "Changer de plan d'abonnement",
    description: 'Upgrade ou downgrade avec calcul de prorata',
  })
  @ApiResponse({
    status: 200,
    description: 'Plan modifié avec succès',
    schema: {
      example: {
        subscription: { planId: 'plan_pro', amount: 99.99 },
        invoice: { amount: 35.67, dueDate: '2024-01-15T00:00:00Z' },
        requiresPayment: true,
      },
    },
  })
  @UseGuards(SubscriptionGuard)
  async changePlan(
    @CurrentTenant('id') tenantId: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    const {
      planId,
      billingCycle,
      prorationBehavior = 'create_prorations',
    } = updateSubscriptionDto;

    if (!planId) {
      throw new BadRequestException('Plan ID is required for plan change');
    }

    return this.subscriptionService.changePlan(
      tenantId,
      planId,
      billingCycle,
      prorationBehavior,
    );
  }

  // ════════════════════════════════════════════════════
  // ❌ ANNULER L'ABONNEMENT
  // ════════════════════════════════════════════════════

  @Delete()
  @ApiOperation({
    summary: "Annuler l'abonnement",
    description: 'Annulation immédiate ou à la fin de la période',
  })
  @ApiQuery({
    name: 'immediately',
    required: false,
    type: Boolean,
    description: 'Annulation immédiate ou en fin de période',
  })
  @ApiResponse({
    status: 200,
    description: 'Abonnement annulé',
    schema: {
      example: {
        subscription: {
          status: 'CANCELED',
          canceledAt: '2024-01-15T00:00:00Z',
        },
        effectiveDate: '2024-02-01T00:00:00Z',
      },
    },
  })
  @UseGuards(SubscriptionGuard)
  async cancelSubscription(
    @CurrentTenant('id') tenantId: string,
    @Query('immediately') immediately: boolean = false,
    @Body() body?: { reason?: string; feedback?: string },
  ) {
    return this.subscriptionService.cancelSubscription(
      tenantId,
      immediately,
      body?.reason,
      body?.feedback,
    );
  }

  // ════════════════════════════════════════════════════
  // 🔄 RÉACTIVER L'ABONNEMENT
  // ════════════════════════════════════════════════════

  @Post('reactivate')
  @ApiOperation({
    summary: 'Réactiver un abonnement annulé',
    description: 'Réactive un abonnement qui était programmé pour annulation',
  })
  @ApiResponse({ status: 200, description: 'Abonnement réactivé' })
  @ApiResponse({ status: 409, description: 'Abonnement déjà actif' })
  @UseGuards(SubscriptionGuard)
  async reactivateSubscription(@CurrentTenant('id') tenantId: string) {
    return this.subscriptionService.reactivateSubscription(tenantId);
  }

  // ════════════════════════════════════════════════════
  // 📊 VÉRIFIER LES LIMITES D'USAGE
  // ════════════════════════════════════════════════════

  @Get('limits')
  @ApiOperation({
    summary: "Vérifier les limites d'usage",
    description: "Retourne l'usage actuel vs les limites du plan",
  })
  @ApiResponse({
    status: 200,
    description: 'Limites vérifiées',
    schema: {
      example: {
        withinLimits: true,
        usage: { users: 12, tickets: 145, storage: 1024, apiCalls: 2500 },
        limits: { users: 50, tickets: 1000, storage: 5120, apiCalls: 10000 },
        violations: [],
        subscription: { plan: { name: 'Pro' } },
      },
    },
  })
  async checkLimits(@CurrentTenant('id') tenantId: string) {
    return this.subscriptionService.checkLimits(tenantId);
  }

  // ════════════════════════════════════════════════════
  // 📈 PRÉVISUALISER UN CHANGEMENT DE PLAN
  // ════════════════════════════════════════════════════

  @Post('preview-change')
  @ApiOperation({
    summary: 'Prévisualiser un changement de plan',
    description: "Calcule le coût/crédit d'un changement de plan",
  })
  @ApiResponse({
    status: 200,
    description: 'Prévisualisation générée',
    schema: {
      example: {
        currentPlan: { name: 'Starter', price: 29.99 },
        newPlan: { name: 'Pro', price: 99.99 },
        priceChange: 70.0,
        prorationAmount: 23.33,
        nextBillingDate: '2024-02-01T00:00:00Z',
      },
    },
  })
  @UseGuards(SubscriptionGuard)
  async previewPlanChange(
    @CurrentTenant('id') tenantId: string,
    @Body() body: { planId: string; billingCycle?: 'MONTHLY' | 'YEARLY' },
  ) {
    // TODO: Implémenter la logique de prévisualisation
    // Peut utiliser stripeService.previewSubscriptionChange()
    throw new Error('Preview functionality not implemented yet');
  }
}
