// ════════════════════════════════════════════════════
// 💳 MODULE FACTURATION COMPLET - CORRIGÉ
// ════════════════════════════════════════════════════

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Services
import { InvoiceService } from './services/invoice.service';
import { PlanService } from './services/plan.service';
import { StripeService } from './services/stripe.service';
import { SubscriptionService } from './services/subscription.service';
import { UsageService } from './services/usage.service';
import { WebhookService } from './services/webhook.service';

// ✅ CORRIGÉ: Import du bon service
import { TenantPrismaFactory } from '../prisma/tenant-prisma.factory';

// Controllers
import { PlansController } from './controllers/plans.controller';
import { SubscriptionController } from './controllers/subscription.controller';
import { UsageController } from './controllers/usage.controller';
import { WebhookController } from './controllers/webhook.controller';

// Guards
import { SubscriptionGuard } from './guards/subscription.guard';
import { UsageLimitGuard } from './guards/usage-limit.guard';

// Processors
import { BillingProcessor } from './processors/billing.processor';
import { UsageProcessor } from './processors/usage.processor';

// Prisma
import { JwtService } from '@nestjs/jwt';
import { ControlPrismaService } from '../prisma/control-prisma.service';

@Module({
  imports: [
    ConfigModule,
    // Queue pour traitement asynchrone
    BullModule.registerQueue({
      name: 'usage-tracking',
    }),
    BullModule.registerQueue({
      name: 'billing',
    }),
  ],
  providers: [
    // Core services
    StripeService,
    SubscriptionService,
    PlanService,
    UsageService,
    InvoiceService,
    WebhookService,

    JwtService,
    // ✅ CORRIGÉ: TenantPrismaFactory dans le bon module
    TenantPrismaFactory,

    // Guards
    SubscriptionGuard,
    UsageLimitGuard,

    // Background processors
    UsageProcessor,
    BillingProcessor,

    // Prisma
    ControlPrismaService,
  ],
  controllers: [
    PlansController,
    SubscriptionController,
    WebhookController,
    UsageController,
  ],
  exports: [
    // Export pour utilisation dans d'autres modules
    StripeService,
    SubscriptionService,
    PlanService,
    UsageService,
    SubscriptionGuard,
    UsageLimitGuard,
    TenantPrismaFactory, // ✅ Disponible pour d'autres modules
  ],
})
export class BillingModule {}
