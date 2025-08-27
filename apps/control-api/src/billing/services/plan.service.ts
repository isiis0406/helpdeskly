import { BillingCycle, Plan } from '.prisma/control';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ControlPrismaService } from '../../prisma/control-prisma.service';
import { getPlanConfig } from '../config/plans.config';

// ✅ INTERFACE CORRIGÉE - Ne pas étendre Plan directement
export interface EnrichedPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  priceMonthly: number;
  priceYearly: number | null;
  currency: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  // Propriétés enrichies
  features: string[];
  highlights: string[];
  isPopular: boolean;
  yearlyDiscount: number;
  displayPrice?: number;
  limits?: any; // Pour les limites du plan
}

export interface PlanComparison {
  plan1: EnrichedPlan;
  plan2: EnrichedPlan;
  differences: {
    price: {
      monthly: number;
      yearly: number;
    };
    features: {
      added: string[];
      removed: string[];
      changed: Array<{ feature: string; before: any; after: any }>;
    };
  };
}

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(private controlPrisma: ControlPrismaService) {}

  // ════════════════════════════════════════════════════
  // 📋 RÉCUPÉRATION DES PLANS - TYPES CORRIGÉS
  // ════════════════════════════════════════════════════

  async getActivePlans(billingCycle?: BillingCycle): Promise<EnrichedPlan[]> {
    try {
      const plans = await this.controlPrisma.plan.findMany({
        where: {
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { priceMonthly: 'asc' }],
      });

      return plans.map((plan) => this.enrichPlanWithConfig(plan, billingCycle));
    } catch (error) {
      this.logger.error('Failed to get active plans:', error);
      throw error;
    }
  }

  async getPlanById(planId: string): Promise<EnrichedPlan> {
    try {
      const plan = await this.controlPrisma.plan.findUnique({
        where: { id: planId },
      });

      if (!plan) {
        throw new NotFoundException(`Plan ${planId} not found`);
      }

      return this.enrichPlanWithConfig(plan);
    } catch (error) {
      this.logger.error(`Failed to get plan ${planId}:`, error);
      throw error;
    }
  }

  async getAllPlans(includeInactive: boolean = false): Promise<Plan[]> {
    try {
      const where = includeInactive ? {} : { isActive: true };

      return await this.controlPrisma.plan.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { priceMonthly: 'asc' }],
      });
    } catch (error) {
      this.logger.error('Failed to get all plans:', error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════
  // 🔍 COMPARAISON DE PLANS
  // ════════════════════════════════════════════════════

  async comparePlans(
    planId1: string,
    planId2: string,
  ): Promise<PlanComparison> {
    try {
      const [plan1, plan2] = await Promise.all([
        this.getPlanById(planId1),
        this.getPlanById(planId2),
      ]);

      return this.calculatePlanDifferences(plan1, plan2);
    } catch (error) {
      this.logger.error(
        `Failed to compare plans ${planId1} vs ${planId2}:`,
        error,
      );
      throw error;
    }
  }

  // ════════════════════════════════════════════════════
  // 💰 CALCULS DE PRIX - TYPES CORRIGÉS
  // ════════════════════════════════════════════════════

  calculatePlanPrice(plan: EnrichedPlan, billingCycle: BillingCycle): number {
    if (billingCycle === BillingCycle.MONTHLY) {
      return plan.priceMonthly;
    } else {
      return plan.priceYearly || 0;
    }
  }

  calculateYearlySavings(plan: EnrichedPlan): number {
    const monthlyAnnual = plan.priceMonthly * 12;
    const yearly = plan.priceYearly || 0;
    return monthlyAnnual - yearly;
  }

  calculateSavingsPercentage(plan: EnrichedPlan): number {
    const savings = this.calculateYearlySavings(plan);
    const monthlyAnnual = plan.priceMonthly * 12;
    return monthlyAnnual > 0 ? Math.round((savings / monthlyAnnual) * 100) : 0;
  }

  // ════════════════════════════════════════════════════
  // 🎯 RECOMMANDATIONS
  // ════════════════════════════════════════════════════

  async getRecommendedPlan(
    currentUsage: {
      users: number;
      tickets: number;
      storage: number;
      apiCalls: number;
    },
    growthFactor: number = 1.5,
  ): Promise<EnrichedPlan> {
    try {
      const plans = await this.getActivePlans();

      const futureNeeds = {
        users: Math.ceil(currentUsage.users * growthFactor),
        tickets: Math.ceil(currentUsage.tickets * growthFactor),
        storage: Math.ceil(currentUsage.storage * growthFactor),
        apiCalls: Math.ceil(currentUsage.apiCalls * growthFactor),
      };

      for (const plan of plans) {
        if (this.planMeetsRequirements(plan, futureNeeds)) {
          return plan;
        }
      }

      return plans[plans.length - 1];
    } catch (error) {
      this.logger.error('Failed to get recommended plan:', error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════
  // 🔧 VALIDATION ET HELPERS
  // ════════════════════════════════════════════════════

  async validatePlanForTenant(
    planId: string,
    tenantId: string,
  ): Promise<boolean> {
    try {
      const plan = await this.getPlanById(planId);

      if (!plan.isActive) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to validate plan ${planId} for tenant ${tenantId}:`,
        error,
      );
      return false;
    }
  }

  planMeetsRequirements(
    plan: EnrichedPlan,
    requirements: {
      users: number;
      tickets: number;
      storage: number;
      apiCalls: number;
    },
  ): boolean {
    const limits = plan.limits;

    if (!limits || typeof limits !== 'object') {
      return true;
    }

    return (
      (!limits.maxUsers || requirements.users <= Number(limits.maxUsers)) &&
      (!limits.maxTickets ||
        requirements.tickets <= Number(limits.maxTickets)) &&
      (!limits.maxStorage ||
        requirements.storage <= Number(limits.maxStorage)) &&
      (!limits.maxApiCalls ||
        requirements.apiCalls <= Number(limits.maxApiCalls))
    );
  }

  // ════════════════════════════════════════════════════
  // 🏷️ GESTION DES FEATURES
  // ════════════════════════════════════════════════════

  getPlanFeatures(plan: EnrichedPlan): string[] {
    return plan.features;
  }

  planHasFeature(plan: EnrichedPlan, feature: string): boolean {
    return plan.features.includes(feature);
  }

  getFeatureDifferences(
    plan1: EnrichedPlan,
    plan2: EnrichedPlan,
  ): { added: string[]; removed: string[] } {
    const features1 = plan1.features;
    const features2 = plan2.features;

    return {
      added: features2.filter((f) => !features1.includes(f)),
      removed: features1.filter((f) => !features2.includes(f)),
    };
  }

  // ════════════════════════════════════════════════════
  // 🔧 MÉTHODES PRIVÉES
  // ════════════════════════════════════════════════════

  private enrichPlanWithConfig(
    plan: Plan,
    billingCycle?: BillingCycle,
  ): EnrichedPlan {
    const config = getPlanConfig(plan.id);

    // ✅ CONVERSION CORRECTE : Plan Prisma → EnrichedPlan
    const enrichedPlan: EnrichedPlan = {
      id: plan.id,
      name: plan.name,
      displayName: plan.displayName,
      description: plan.description,
      priceMonthly: Number(plan.priceMonthly), // Conversion Decimal → number
      priceYearly: plan.priceYearly ? Number(plan.priceYearly) : null,
      currency: plan.currency,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      // Propriétés enrichies
      features:
        config?.features?.map((feature) => feature.name || String(feature)) ||
        [],
      highlights: config?.description ? [config.description] : [],
      isPopular: config?.isPopular || false,
      yearlyDiscount: 0, // Sera calculé ci-dessous
    };

    // Calculer le discount après avoir créé l'objet
    enrichedPlan.yearlyDiscount = this.calculateSavingsPercentage(enrichedPlan);

    if (billingCycle) {
      enrichedPlan.displayPrice = this.calculatePlanPrice(
        enrichedPlan,
        billingCycle,
      );
    }

    return enrichedPlan;
  }

  private calculatePlanDifferences(
    plan1: EnrichedPlan,
    plan2: EnrichedPlan,
  ): PlanComparison {
    const priceDiff = {
      monthly: plan2.priceMonthly - plan1.priceMonthly,
      yearly: (plan2.priceYearly || 0) - (plan1.priceYearly || 0),
    };

    const featureDiff = this.getFeatureDifferences(plan1, plan2);

    return {
      plan1,
      plan2,
      differences: {
        price: priceDiff,
        features: {
          ...featureDiff,
          changed: [],
        },
      },
    };
  }
}
