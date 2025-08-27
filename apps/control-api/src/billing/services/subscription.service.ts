import {
  BillingCycle,
  Plan,
  Subscription,
  SubscriptionStatus,
  Tenant,
} from '.prisma/control';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import Stripe from 'stripe';
import { ControlPrismaService } from '../../prisma/control-prisma.service';
import { BILLING_CONFIG } from '../config/plans.config';
import { PlanService } from './plan.service';
import { StripeService } from './stripe.service';
import { UsageService } from './usage.service';

// ════════════════════════════════════════════════════
// 🏗️ INTERFACES ET TYPES
// ════════════════════════════════════════════════════

export interface CreateSubscriptionData {
  tenantId: string;
  planId: string;
  billingCycle: BillingCycle;
  trialDays?: number;
  paymentMethodId?: string;
  couponCode?: string;
}

export interface UpdateSubscriptionData {
  planId?: string;
  billingCycle?: BillingCycle;
  quantity?: number;
  metadata?: Record<string, string>;
}

export interface SubscriptionWithRelations extends Subscription {
  plan: Plan;
  tenant: Tenant;
  invoices?: any[];
}

export interface SubscriptionChangeLog {
  action:
    | 'CREATION'
    | 'PLAN_CHANGE'
    | 'CANCELLATION'
    | 'REACTIVATION'
    | 'PAYMENT_FAILED';
  fromPlan?: string;
  toPlan?: string;
  reason?: string;
  feedback?: string;
  immediately?: boolean;
  effectiveDate?: string;
  priceChange?: number;
  billingCycle?: BillingCycle;
  metadata?: Record<string, any>;
}

export interface UsageLimitsCheck {
  withinLimits: boolean;
  usage: {
    users: number;
    tickets: number;
    storage: number;
    apiCalls: number;
  };
  limits: {
    users: number;
    tickets: number;
    storage: number;
    apiCalls: number;
  };
  violations: string[];
  subscription: SubscriptionWithRelations | null;
}

// ════════════════════════════════════════════════════
// 🔄 SERVICE PRINCIPAL
// ════════════════════════════════════════════════════

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private controlPrisma: ControlPrismaService,
    private stripeService: StripeService,
    private usageService: UsageService,
    private planService: PlanService,
  ) {}

  // ════════════════════════════════════════════════════
  // 🆕 CRÉATION D'ABONNEMENT
  // ════════════════════════════════════════════════════

  async createSubscription(data: CreateSubscriptionData): Promise<{
    subscription: SubscriptionWithRelations;
    clientSecret?: string;
    requiresPayment: boolean;
  }> {
    const {
      tenantId,
      planId,
      billingCycle,
      trialDays = BILLING_CONFIG.FREE_TRIAL_DAYS,
    } = data;

    try {
      // 1. Vérifications préliminaires
      await this.validateSubscriptionCreation(tenantId, planId);

      const tenant = await this.getTenantWithDetails(tenantId);
      const plan = await this.planService.getPlanById(planId);

      // 2. Créer ou récupérer le customer Stripe
      const stripeCustomerId = await this.ensureStripeCustomer(tenant);

      // 3. Attacher la méthode de paiement si fournie
      if (data.paymentMethodId) {
        await this.attachPaymentMethod(stripeCustomerId, data.paymentMethodId);
      }

      // 4. Créer l'abonnement Stripe
      const stripeSubscription = await this.stripeService.createSubscription({
        customerId: stripeCustomerId,
        planId,
        billingCycle,
        trialDays,
        metadata: {
          tenantId,
          tenantSlug: tenant.slug,
          planId,
          billingCycle,
        },
      });

      // 5. Créer l'abonnement en base de données
      const subscription = await this.createDatabaseSubscription({
        tenant,
        plan,
        stripeSubscription,
        billingCycle,
        trialDays,
      });

      // 6. Mettre à jour le statut du tenant
      await this.updateTenantSubscriptionStatus(tenantId, {
        status: 'ACTIVE',
        isTrialing: !!stripeSubscription.trial_end,
        trialEndsAt: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
        stripeCustomerId,
      });

      // 7. Initialiser le tracking d'usage
      await this.usageService.initializeUsageTracking(tenantId);

      // 8. Log de création
      await this.logSubscriptionChange(tenantId, {
        action: 'CREATION',
        toPlan: planId,
        billingCycle,
        metadata: { trialDays, hasPaymentMethod: !!data.paymentMethodId },
      });

      this.logger.log(
        `✅ Subscription created successfully for tenant ${tenantId}: ${subscription.id}`,
      );

      // 9. Déterminer si un paiement est requis
      const requiresPayment = this.requiresImmediatePayment(stripeSubscription);
      let clientSecret: string | undefined;

      if (requiresPayment && stripeSubscription.latest_invoice) {
        clientSecret = await this.extractClientSecret(
          stripeSubscription.latest_invoice,
        );
      }

      return {
        subscription: subscription as SubscriptionWithRelations,
        clientSecret,
        requiresPayment,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to create subscription for tenant ${tenantId}:`,
        error,
      );
      throw error;
    }
  }

  // ════════════════════════════════════════════════════
  // 🔄 CHANGEMENT DE PLAN
  // ════════════════════════════════════════════════════

  async changePlan(
    tenantId: string,
    newPlanId: string,
    billingCycle?: BillingCycle,
    prorationBehavior:
      | 'create_prorations'
      | 'none'
      | 'always_invoice' = 'create_prorations',
  ): Promise<{
    subscription: SubscriptionWithRelations;
    invoice?: any;
    requiresPayment: boolean;
  }> {
    try {
      // 1. Récupérer l'abonnement actuel
      const currentSubscription = await this.getSubscriptionByTenant(tenantId);
      if (!currentSubscription) {
        throw new NotFoundException('No active subscription found');
      }

      // 2. Valider le nouveau plan
      const newPlan = await this.planService.getPlanById(newPlanId);
      const currentPlan = currentSubscription.plan;

      if (
        currentPlan.id === newPlanId &&
        (!billingCycle || billingCycle === currentSubscription.billingCycle)
      ) {
        throw new BadRequestException(
          'Already subscribed to this plan and billing cycle',
        );
      }

      // 3. Vérifier les limites d'usage pour les downgrades
      await this.validatePlanChange(tenantId, newPlan, currentPlan);

      // 4. Calculer le changement de prix
      const targetBillingCycle =
        billingCycle || currentSubscription.billingCycle;
      const priceChange = this.calculatePriceChange(
        currentPlan,
        newPlan,
        targetBillingCycle,
      );

      this.logger.log(
        `Plan change for tenant ${tenantId}: ${currentPlan.name} -> ${newPlan.name} (${priceChange > 0 ? 'upgrade' : 'downgrade'})`,
      );

      // 5. Mettre à jour dans Stripe
      const stripeSubscription = await this.stripeService.updateSubscription(
        currentSubscription.stripeSubscriptionId!,
        {
          planId: newPlanId,
          billingCycle: targetBillingCycle,
          proration_behavior: prorationBehavior,
          metadata: {
            tenantId,
            planId: newPlanId,
            previousPlanId: currentPlan.id,
            changeDate: new Date().toISOString(),
            billingCycle: targetBillingCycle,
          },
        },
      );

      // 6. Calculer le nouveau montant
      const newAmount = this.calculatePlanAmount(newPlan, targetBillingCycle);

      // 7. Mettre à jour en base de données
      const updatedSubscription = await this.controlPrisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          planId: newPlanId,
          billingCycle: targetBillingCycle,
          amount: newAmount,
          status: this.stripeService.mapStripeStatusToSubscriptionStatus(
            stripeSubscription.status,
          ),
          updatedAt: new Date(),
        },
        include: {
          plan: true,
          tenant: true,
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      // 8. Récupérer la facture de changement de plan si elle existe
      let invoice: any = null;
      let requiresPayment = false;

      if (priceChange > 0 && stripeSubscription.latest_invoice) {
        try {
          const latestInvoice = await this.stripeService
            .getStripeInstance()
            .invoices.retrieve(stripeSubscription.latest_invoice as string);

          if (latestInvoice.status === 'open' && latestInvoice.amount_due > 0) {
            invoice = latestInvoice;
            requiresPayment = true;
          }
        } catch (error) {
          this.logger.warn(
            `Could not retrieve latest invoice: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // 9. Log du changement
      await this.logSubscriptionChange(tenantId, {
        action: 'PLAN_CHANGE',
        fromPlan: currentPlan.id,
        toPlan: newPlanId,
        priceChange,
        billingCycle: targetBillingCycle,
      });

      this.logger.log(`✅ Plan changed successfully for tenant ${tenantId}`);

      return {
        subscription: updatedSubscription,
        invoice,
        requiresPayment,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to change plan for tenant ${tenantId}:`,
        error,
      );
      throw error;
    }
  }

  // ════════════════════════════════════════════════════
  // ❌ ANNULATION D'ABONNEMENT
  // ════════════════════════════════════════════════════

  async cancelSubscription(
    tenantId: string,
    immediately: boolean = false,
    reason?: string,
    feedback?: string,
  ): Promise<{
    subscription: SubscriptionWithRelations;
    effectiveDate: Date;
  }> {
    try {
      const subscription = await this.getSubscriptionByTenant(tenantId);
      if (!subscription) {
        throw new NotFoundException('No active subscription found');
      }

      if (subscription.status === SubscriptionStatus.CANCELED) {
        throw new ConflictException('Subscription is already canceled');
      }

      // 1. Annuler dans Stripe
      const stripeSubscription = await this.stripeService.cancelSubscription(
        subscription.stripeSubscriptionId!,
        immediately,
        reason,
      );

      // 2. Calculer la date effective
      const effectiveDate = immediately
        ? new Date()
        : new Date(stripeSubscription.current_period_end * 1000);

      // 3. Mettre à jour en base
      const updatedSubscription = await this.controlPrisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: immediately
            ? SubscriptionStatus.CANCELED
            : SubscriptionStatus.ACTIVE,
          canceledAt: immediately ? new Date() : null,
          endDate: effectiveDate,
          cancelReason: reason,
          updatedAt: new Date(),
        },
        include: {
          plan: true,
          tenant: true,
        },
      });

      // 4. Mettre à jour le statut du tenant si annulation immédiate
      if (immediately) {
        await this.controlPrisma.tenant.update({
          where: { id: tenantId },
          data: {
            status: 'SUSPENDED',
            isTrialing: false,
          },
        });
      }

      // 5. Log de l'annulation
      await this.logSubscriptionChange(tenantId, {
        action: 'CANCELLATION',
        reason,
        feedback,
        immediately,
        effectiveDate: effectiveDate.toISOString(),
      });

      this.logger.log(
        `✅ Subscription ${immediately ? 'canceled immediately' : 'scheduled for cancellation'} for tenant ${tenantId}`,
      );

      return {
        subscription: updatedSubscription,
        effectiveDate,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to cancel subscription for tenant ${tenantId}:`,
        error,
      );
      throw error;
    }
  }

  // ════════════════════════════════════════════════════
  // 🔄 RÉACTIVATION D'ABONNEMENT
  // ════════════════════════════════════════════════════

  async reactivateSubscription(
    tenantId: string,
  ): Promise<SubscriptionWithRelations> {
    try {
      const subscription = await this.getSubscriptionByTenant(tenantId);
      if (!subscription) {
        throw new NotFoundException('No subscription found');
      }

      if (subscription.status === SubscriptionStatus.ACTIVE) {
        throw new ConflictException('Subscription is already active');
      }

      // 1. Réactiver dans Stripe
      const stripeSubscription =
        await this.stripeService.reactivateSubscription(
          subscription.stripeSubscriptionId!,
        );

      const stripeSubTyped = stripeSubscription as Stripe.Subscription;

      // 2. Mettre à jour en base
      const updatedSubscription = await this.controlPrisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          canceledAt: null,
          cancelReason: null,
          endDate: new Date(stripeSubTyped.current_period_end * 1000),
          updatedAt: new Date(),
        },
        include: {
          plan: true,
          tenant: true,
        },
      });

      // 3. Réactiver le tenant
      await this.controlPrisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'ACTIVE' },
      });

      // 4. Log de la réactivation
      await this.logSubscriptionChange(tenantId, {
        action: 'REACTIVATION',
      });

      this.logger.log(`✅ Subscription reactivated for tenant ${tenantId}`);

      return updatedSubscription;
    } catch (error) {
      this.logger.error(
        `❌ Failed to reactivate subscription for tenant ${tenantId}:`,
        error,
      );
      throw error;
    }
  }

  // ════════════════════════════════════════════════════
  // 📊 VÉRIFICATION DES LIMITES
  // ════════════════════════════════════════════════════

  async checkLimits(tenantId: string): Promise<UsageLimitsCheck> {
    try {
      const subscription = await this.getSubscriptionByTenant(tenantId);

      if (!subscription) {
        return {
          withinLimits: false,
          usage: { users: 0, tickets: 0, storage: 0, apiCalls: 0 },
          limits: { users: 0, tickets: 0, storage: 0, apiCalls: 0 },
          violations: ['No active subscription'],
          subscription: null,
        };
      }

      // Vérifier si l'abonnement est actif
      if (
        subscription.status !== SubscriptionStatus.ACTIVE &&
        subscription.status !== SubscriptionStatus.TRIALING
      ) {
        return {
          withinLimits: false,
          usage: { users: 0, tickets: 0, storage: 0, apiCalls: 0 },
          limits: { users: 0, tickets: 0, storage: 0, apiCalls: 0 },
          violations: [`Subscription status: ${subscription.status}`],
          subscription,
        };
      }

      const currentUsage = await this.usageService.getCurrentUsage(tenantId);

      // ✅ CORRIGÉ: Récupérer les limites depuis plan.limits (JSON)
      const planLimits = subscription.plan.limits as any;
      const limits = {
        users: planLimits?.maxUsers || -1,
        tickets: planLimits?.maxTickets || -1,
        storage: planLimits?.maxStorage || -1,
        apiCalls: planLimits?.maxApiCalls || -1,
      };

      const violations: string[] = [];

      // Vérifier chaque limite (-1 = illimité)
      if (limits.users !== -1 && currentUsage.users > limits.users) {
        violations.push(`Users: ${currentUsage.users}/${limits.users}`);
      }

      if (limits.tickets !== -1 && currentUsage.tickets > limits.tickets) {
        violations.push(`Tickets: ${currentUsage.tickets}/${limits.tickets}`);
      }

      if (limits.storage !== -1 && currentUsage.storage > limits.storage) {
        violations.push(
          `Storage: ${currentUsage.storage}MB/${limits.storage}MB`,
        );
      }

      if (limits.apiCalls !== -1 && currentUsage.apiCalls > limits.apiCalls) {
        violations.push(
          `API Calls: ${currentUsage.apiCalls}/${limits.apiCalls} (monthly)`,
        );
      }

      return {
        withinLimits: violations.length === 0,
        usage: currentUsage,
        limits,
        violations,
        subscription,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to check limits for tenant ${tenantId}:`,
        error,
      );
      return {
        withinLimits: false,
        usage: { users: 0, tickets: 0, storage: 0, apiCalls: 0 },
        limits: { users: 0, tickets: 0, storage: 0, apiCalls: 0 },
        violations: ['Error checking limits'],
        subscription: null,
      };
    }
  }

  // ════════════════════════════════════════════════════
  // 🔍 GETTERS
  // ════════════════════════════════════════════════════

  async getSubscriptionByTenant(
    tenantId: string,
  ): Promise<SubscriptionWithRelations | null> {
    try {
      return await this.controlPrisma.subscription.findUnique({
        where: { tenantId },
        include: {
          plan: true,
          tenant: true,
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `❌ Failed to get subscription for tenant ${tenantId}:`,
        error,
      );
      return null;
    }
  }

  async getSubscriptionById(
    subscriptionId: string,
  ): Promise<SubscriptionWithRelations | null> {
    try {
      return await this.controlPrisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          plan: true,
          tenant: true,
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `❌ Failed to get subscription ${subscriptionId}:`,
        error,
      );
      return null;
    }
  }

  async getAllSubscriptions(
    params: {
      skip?: number;
      take?: number;
      status?: SubscriptionStatus;
      planId?: string;
      search?: string;
    } = {},
  ) {
    try {
      const { skip = 0, take = 50, status, planId, search } = params;

      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (planId) {
        where.planId = planId;
      }

      if (search) {
        where.OR = [
          {
            tenant: {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
          {
            tenant: {
              slug: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        ];
      }

      const [subscriptions, total] = await Promise.all([
        this.controlPrisma.subscription.findMany({
          skip,
          take,
          where,
          include: {
            plan: true,
            tenant: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.controlPrisma.subscription.count({ where }),
      ]);

      return {
        subscriptions,
        total,
        hasMore: skip + take < total,
      };
    } catch (error) {
      this.logger.error('❌ Failed to get all subscriptions:', error);
      return {
        subscriptions: [],
        total: 0,
        hasMore: false,
      };
    }
  }

  // ════════════════════════════════════════════════════
  // 🔄 SYNCHRONISATION AVEC STRIPE
  // ════════════════════════════════════════════════════

  async syncSubscriptionFromStripe(
    stripeSubscription: Stripe.Subscription,
  ): Promise<void> {
    try {
      const tenantId = stripeSubscription.metadata?.tenantId;

      if (!tenantId) {
        this.logger.warn(
          `⚠️ No tenantId in subscription metadata: ${stripeSubscription.id}`,
        );
        return;
      }

      const planId =
        stripeSubscription.metadata?.planId ||
        (await this.getPlanIdFromStripePrice(
          stripeSubscription.items.data[0].price.id,
        ));

      if (!planId) {
        this.logger.error(
          `❌ Could not determine planId for subscription: ${stripeSubscription.id}`,
        );
        return;
      }

      const plan = await this.planService.getPlanById(planId);
      const billingCycle = this.getBillingCycleFromInterval(
        stripeSubscription.items.data[0].price.recurring?.interval,
      );

      // ✅ CORRIGÉ: Conversion Decimal
      const amount = stripeSubscription.items.data[0].price.unit_amount
        ? new Decimal(stripeSubscription.items.data[0].price.unit_amount / 100)
        : new Decimal(0);

      await this.controlPrisma.subscription.upsert({
        where: { stripeSubscriptionId: stripeSubscription.id },
        update: {
          status: this.stripeService.mapStripeStatusToSubscriptionStatus(
            stripeSubscription.status,
          ),
          amount,
          startDate: new Date(stripeSubscription.current_period_start * 1000),
          endDate: new Date(stripeSubscription.current_period_end * 1000),
          trialEndDate: stripeSubscription.trial_end
            ? new Date(stripeSubscription.trial_end * 1000)
            : null,
          canceledAt: stripeSubscription.canceled_at
            ? new Date(stripeSubscription.canceled_at * 1000)
            : null,
          updatedAt: new Date(),
        },
        create: {
          tenantId,
          planId,
          stripeSubscriptionId: stripeSubscription.id,
          stripePriceId: stripeSubscription.items.data[0].price.id,
          status: this.stripeService.mapStripeStatusToSubscriptionStatus(
            stripeSubscription.status,
          ),
          billingCycle,
          amount,
          currency: stripeSubscription.items.data[0].price.currency,
          startDate: new Date(stripeSubscription.current_period_start * 1000),
          endDate: new Date(stripeSubscription.current_period_end * 1000),
          trialEndDate: stripeSubscription.trial_end
            ? new Date(stripeSubscription.trial_end * 1000)
            : null,
        },
      });

      this.logger.log(
        `✅ Subscription synced from Stripe: ${stripeSubscription.id}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to sync subscription from Stripe: ${stripeSubscription.id}`,
        error,
      );
      throw error;
    }
  }

  async handleSubscriptionCanceled(
    tenantId: string,
    subscriptionId: string,
  ): Promise<void> {
    try {
      await this.controlPrisma.subscription.update({
        where: { stripeSubscriptionId: subscriptionId },
        data: {
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await this.controlPrisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: 'SUSPENDED',
          isTrialing: false,
        },
      });

      this.logger.log(
        `✅ Subscription cancellation handled for tenant: ${tenantId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to handle subscription cancellation for tenant ${tenantId}:`,
        error,
      );
      throw error;
    }
  }

  async activateSubscriptionAfterPayment(
    subscriptionId: string,
  ): Promise<void> {
    try {
      const subscription = await this.controlPrisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscriptionId },
        include: { tenant: true },
      });

      if (!subscription) {
        this.logger.warn(`⚠️ Subscription not found: ${subscriptionId}`);
        return;
      }

      if (subscription.status === SubscriptionStatus.INCOMPLETE) {
        await this.controlPrisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
            updatedAt: new Date(),
          },
        });

        await this.controlPrisma.tenant.update({
          where: { id: subscription.tenantId },
          data: { status: 'ACTIVE' },
        });

        this.logger.log(
          `✅ Subscription activated after payment: ${subscriptionId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to activate subscription after payment: ${subscriptionId}`,
        error,
      );
      throw error;
    }
  }

  // ════════════════════════════════════════════════════
  // 🔧 HELPERS PRIVÉS
  // ════════════════════════════════════════════════════

  private async validateSubscriptionCreation(
    tenantId: string,
    planId: string,
  ): Promise<void> {
    const tenant = await this.controlPrisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.subscription) {
      throw new ConflictException('Tenant already has an active subscription');
    }

    const plan = await this.planService.getPlanById(planId);
    if (!plan.isActive) {
      throw new BadRequestException('Plan is not active');
    }
  }

  private async getTenantWithDetails(tenantId: string) {
    const tenant = await this.controlPrisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  private async ensureStripeCustomer(tenant: any): Promise<string> {
    if (tenant.stripeCustomerId) {
      return tenant.stripeCustomerId;
    }

    const stripeCustomer = await this.stripeService.createCustomer({
      email: tenant.billingEmail || `billing@${tenant.slug}.com`,
      name: tenant.name || tenant.slug,
      tenantId: tenant.id,
      metadata: {
        tenantSlug: tenant.slug,
        createdFrom: 'subscription_creation',
      },
    });

    await this.controlPrisma.tenant.update({
      where: { id: tenant.id },
      data: { stripeCustomerId: stripeCustomer.id },
    });

    return stripeCustomer.id;
  }

  private async attachPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<void> {
    try {
      await this.stripeService
        .getStripeInstance()
        .paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        });

      await this.stripeService.setDefaultPaymentMethod(
        customerId,
        paymentMethodId,
      );

      this.logger.log(
        `✅ Payment method ${paymentMethodId} attached to customer ${customerId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to attach payment method: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        `Failed to attach payment method: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async createDatabaseSubscription(data: {
    tenant: any;
    plan: any;
    stripeSubscription: Stripe.Subscription;
    billingCycle: BillingCycle;
    trialDays?: number;
  }) {
    const { tenant, plan, stripeSubscription, billingCycle } = data;

    // ✅ CORRIGÉ: Conversion Decimal pour Prisma
    const amount = this.calculatePlanAmount(plan, billingCycle);

    return this.controlPrisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: stripeSubscription.items.data[0].price.id,
        status: this.stripeService.mapStripeStatusToSubscriptionStatus(
          stripeSubscription.status,
        ),
        billingCycle,
        amount,
        currency: plan.currency,
        startDate: new Date(stripeSubscription.current_period_start * 1000),
        endDate: new Date(stripeSubscription.current_period_end * 1000),
        trialEndDate: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
      },
      include: {
        plan: true,
        tenant: true,
      },
    });
  }

  private async updateTenantSubscriptionStatus(
    tenantId: string,
    data: any,
  ): Promise<void> {
    await this.controlPrisma.tenant.update({
      where: { id: tenantId },
      data,
    });
  }

  private requiresImmediatePayment(
    stripeSubscription: Stripe.Subscription,
  ): boolean {
    if (
      !stripeSubscription.trial_end &&
      stripeSubscription.latest_invoice &&
      typeof stripeSubscription.latest_invoice === 'object' &&
      'amount_due' in stripeSubscription.latest_invoice
    ) {
      return (stripeSubscription.latest_invoice as any).amount_due > 0;
    }
    return false;
  }

  // Dans la méthode extractClientSecret - ligne ~671
  private async extractClientSecret(
    latestInvoice: string | Stripe.Invoice,
  ): Promise<string | undefined> {
    try {
      let invoice: Stripe.Invoice;

      if (typeof latestInvoice === 'string') {
        invoice = await this.stripeService
          .getStripeInstance()
          .invoices.retrieve(latestInvoice);
      } else {
        invoice = latestInvoice;
      }

      // ✅ CORRIGÉ: Vérification correcte du payment_intent avec type assertion
      const paymentIntent = (invoice as any).payment_intent;
      if (paymentIntent) {
        if (typeof paymentIntent === 'string') {
          const paymentIntentObj = await this.stripeService
            .getStripeInstance()
            .paymentIntents.retrieve(paymentIntent);
          return paymentIntentObj.client_secret || undefined;
        } else {
          return paymentIntent.client_secret || undefined;
        }
      }
    } catch (error) {
      this.logger.warn(
        `Could not extract client secret: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return undefined;
  }

  private async validatePlanChange(
    tenantId: string,
    newPlan: any,
    currentPlan: any,
  ): Promise<void> {
    const newPlanPrice = Number(newPlan.priceMonthly);
    const currentPlanPrice = Number(currentPlan.priceMonthly);

    if (newPlanPrice < currentPlanPrice) {
      const currentUsage = await this.usageService.getCurrentUsage(tenantId);
      const newPlanLimits = newPlan.limits as any;
      const violations: string[] = [];

      if (
        newPlanLimits?.maxUsers &&
        currentUsage.users > newPlanLimits.maxUsers
      ) {
        violations.push(
          `Users: current ${currentUsage.users} > limit ${newPlanLimits.maxUsers}`,
        );
      }

      if (
        newPlanLimits?.maxTickets &&
        currentUsage.tickets > newPlanLimits.maxTickets
      ) {
        violations.push(
          `Tickets: current ${currentUsage.tickets} > limit ${newPlanLimits.maxTickets}`,
        );
      }

      if (
        newPlanLimits?.maxStorage &&
        currentUsage.storage > newPlanLimits.maxStorage
      ) {
        violations.push(
          `Storage: current ${currentUsage.storage}MB > limit ${newPlanLimits.maxStorage}MB`,
        );
      }

      if (violations.length > 0) {
        throw new BadRequestException(
          `Cannot downgrade due to usage limits: ${violations.join(', ')}`,
        );
      }
    }
  }

  private calculatePriceChange(
    currentPlan: any,
    newPlan: any,
    billingCycle: BillingCycle,
  ): number {
    const currentPrice =
      billingCycle === BillingCycle.MONTHLY
        ? Number(currentPlan.priceMonthly)
        : Number(currentPlan.priceYearly || currentPlan.priceMonthly * 12);

    const newPrice =
      billingCycle === BillingCycle.MONTHLY
        ? Number(newPlan.priceMonthly)
        : Number(newPlan.priceYearly || newPlan.priceMonthly * 12);

    return newPrice - currentPrice;
  }

  private calculatePlanAmount(plan: any, billingCycle: BillingCycle): Decimal {
    const amount =
      billingCycle === BillingCycle.MONTHLY
        ? Number(plan.priceMonthly)
        : Number(plan.priceYearly || plan.priceMonthly * 12);

    return new Decimal(amount);
  }

  private async getPlanIdFromStripePrice(
    stripePriceId: string,
  ): Promise<string | null> {
    try {
      const plan = await this.controlPrisma.plan.findFirst({
        where: {
          OR: [
            { stripePriceIdMonthly: stripePriceId },
            { stripePriceIdYearly: stripePriceId },
          ],
        },
        select: { id: true },
      });

      return plan?.id || null;
    } catch (error) {
      this.logger.error(
        `❌ Failed to get planId from Stripe price: ${stripePriceId}`,
        error,
      );
      return null;
    }
  }

  private getBillingCycleFromInterval(interval?: string): BillingCycle {
    switch (interval) {
      case 'month':
        return BillingCycle.MONTHLY;
      case 'year':
        return BillingCycle.YEARLY;
      default:
        return BillingCycle.MONTHLY;
    }
  }

  private async logSubscriptionChange(
    tenantId: string,
    data: SubscriptionChangeLog,
  ): Promise<void> {
    this.logger.log(
      `Subscription change for tenant ${tenantId}:`,
      JSON.stringify(data),
    );

    // TODO: Créer une table subscription_changes pour l'audit
    // await this.controlPrisma.subscriptionChange.create({
    //   data: {
    //     tenantId,
    //     ...data,
    //   }
    // });
  }
}
