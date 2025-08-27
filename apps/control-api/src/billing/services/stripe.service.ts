// ════════════════════════════════════════════════════
// 💳 SERVICE STRIPE COMPLET - COMPATIBLE v15+
// ════════════════════════════════════════════════════

import { BillingCycle, SubscriptionStatus } from '.prisma/control';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { getPlanConfig } from '../config/plans.config';

export interface StripeCustomerData {
  email: string;
  name: string;
  tenantId: string;
  metadata?: Record<string, string>;
}

export interface StripeSubscriptionData {
  customerId: string;
  planId: string;
  billingCycle: BillingCycle;
  trialDays?: number;
  metadata?: Record<string, string>;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;

  constructor(private configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is required in environment variables');
    }

    // ✅ ACCEPTER la version par défaut de Stripe v15+
    this.stripe = new Stripe(stripeSecretKey, {
      // ✅ Pas de version API spécifiée = utilise la version par défaut
      typescript: true,
    });

    this.logger.log('Stripe service initialized with default API version');
  }

  // ════════════════════════════════════════════════════
  // 👤 CUSTOMER MANAGEMENT - INCHANGÉ
  // ════════════════════════════════════════════════════

  async createCustomer(data: StripeCustomerData): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email: data.email,
        name: data.name,
        metadata: {
          tenantId: data.tenantId,
          source: 'helpdeskly',
          ...data.metadata,
        },
      });

      this.logger.log(
        `✅ Customer created: ${customer.id} for tenant: ${data.tenantId}`,
      );
      return customer;
    } catch (error) {
      this.logger.error(
        `❌ Failed to create customer for tenant ${data.tenantId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to create Stripe customer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async updateCustomer(
    customerId: string,
    data: Partial<{
      email: string;
      name: string;
      metadata: Record<string, string>;
    }>,
  ): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.update(customerId, data);
      this.logger.log(`✅ Customer updated: ${customerId}`);
      return customer;
    } catch (error) {
      this.logger.error(
        `❌ Failed to update customer ${customerId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to update Stripe customer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      return (await this.stripe.customers.retrieve(
        customerId,
      )) as Stripe.Customer;
    } catch (error) {
      this.logger.error(
        `❌ Failed to retrieve customer ${customerId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to retrieve Stripe customer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deleteCustomer(customerId: string): Promise<Stripe.DeletedCustomer> {
    try {
      const deleted = await this.stripe.customers.del(customerId);
      this.logger.log(`✅ Customer deleted: ${customerId}`);
      return deleted;
    } catch (error) {
      this.logger.error(
        `❌ Failed to delete customer ${customerId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to delete Stripe customer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ════════════════════════════════════════════════════
  // 🔄 SUBSCRIPTION MANAGEMENT - INCHANGÉ
  // ════════════════════════════════════════════════════

  async createSubscription(
    data: StripeSubscriptionData,
  ): Promise<Stripe.Subscription> {
    try {
      const plan = getPlanConfig(data.planId);
      if (!plan) {
        throw new Error(`Plan configuration not found: ${data.planId}`);
      }

      const priceId =
        data.billingCycle === BillingCycle.MONTHLY
          ? plan.stripe.priceIdMonthly
          : plan.stripe.priceIdYearly;

      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: data.customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
          payment_method_types: ['card'],
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          planId: data.planId,
          billingCycle: data.billingCycle,
          tenantId: data.metadata?.tenantId || '',
          source: 'helpdeskly',
          ...data.metadata,
        },
        collection_method: 'charge_automatically',
      };

      if (data.trialDays && data.trialDays > 0) {
        subscriptionParams.trial_period_days = data.trialDays;
      }

      const subscription =
        await this.stripe.subscriptions.create(subscriptionParams);

      this.logger.log(
        `✅ Subscription created: ${subscription.id} for customer: ${data.customerId}`,
      );
      return subscription;
    } catch (error) {
      this.logger.error(
        `❌ Failed to create subscription:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to create Stripe subscription: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async updateSubscription(
    subscriptionId: string,
    data: {
      planId?: string;
      billingCycle?: BillingCycle;
      quantity?: number;
      metadata?: Record<string, string>;
      proration_behavior?: 'create_prorations' | 'none' | 'always_invoice';
    },
  ): Promise<Stripe.Subscription> {
    try {
      const updateParams: Stripe.SubscriptionUpdateParams = {};

      if (data.planId || data.billingCycle) {
        const plan = getPlanConfig(data.planId!);
        if (!plan) {
          throw new Error(`Plan configuration not found: ${data.planId}`);
        }

        const priceId =
          data.billingCycle === BillingCycle.MONTHLY
            ? plan.stripe.priceIdMonthly
            : plan.stripe.priceIdYearly;

        const currentSubscription =
          await this.stripe.subscriptions.retrieve(subscriptionId);

        updateParams.items = [
          {
            id: currentSubscription.items.data[0].id,
            price: priceId,
          },
        ];

        updateParams.proration_behavior =
          data.proration_behavior || 'create_prorations';
      }

      if (data.quantity) {
        if (!updateParams.items) {
          const currentSubscription =
            await this.stripe.subscriptions.retrieve(subscriptionId);

          updateParams.items = [
            {
              id: currentSubscription.items.data[0].id,
              quantity: data.quantity,
            },
          ];
        } else {
          updateParams.items[0].quantity = data.quantity;
        }
      }

      if (data.metadata) {
        updateParams.metadata = {
          ...data.metadata,
          updatedAt: new Date().toISOString(),
        };
      }

      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        updateParams,
      );

      this.logger.log(`✅ Subscription updated: ${subscriptionId}`);
      return subscription;
    } catch (error) {
      this.logger.error(
        `❌ Failed to update subscription ${subscriptionId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to update Stripe subscription: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false,
    reason?: string,
  ): Promise<Stripe.Subscription> {
    try {
      let subscription: Stripe.Subscription;

      if (immediately) {
        subscription = await this.stripe.subscriptions.cancel(subscriptionId, {
          invoice_now: true,
          prorate: true,
        });
      } else {
        subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
          metadata: {
            cancellation_reason: reason || 'User requested',
            cancelled_at: new Date().toISOString(),
          },
        });
      }

      this.logger.log(
        `✅ Subscription ${immediately ? 'canceled immediately' : 'scheduled for cancellation'}: ${subscriptionId}`,
      );
      return subscription;
    } catch (error) {
      this.logger.error(
        `❌ Failed to cancel subscription ${subscriptionId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to cancel Stripe subscription: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async reactivateSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        {
          cancel_at_period_end: false,
          metadata: {
            reactivated_at: new Date().toISOString(),
          },
        },
      );

      this.logger.log(`✅ Subscription reactivated: ${subscriptionId}`);
      return subscription;
    } catch (error) {
      this.logger.error(
        `❌ Failed to reactivate subscription ${subscriptionId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to reactivate Stripe subscription: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['customer', 'items.data.price.product'],
      });
    } catch (error) {
      this.logger.error(
        `❌ Failed to retrieve subscription ${subscriptionId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to retrieve Stripe subscription: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ════════════════════════════════════════════════════
  // 🧾 INVOICE MANAGEMENT - NOUVELLE API v15+
  // ════════════════════════════════════════════════════

  async getInvoices(
    customerId: string,
    options: {
      limit?: number;
      starting_after?: string;
      status?: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
    } = {},
  ): Promise<Stripe.Invoice[]> {
    try {
      const { limit = 10, starting_after, status } = options;

      const invoices = await this.stripe.invoices.list({
        customer: customerId,
        limit,
        starting_after,
        status,
        expand: ['data.subscription'],
      });

      return invoices.data;
    } catch (error) {
      this.logger.error(
        `❌ Failed to retrieve invoices for customer ${customerId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to retrieve Stripe invoices: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getUpcomingInvoice(
    subscriptionId: string,
  ): Promise<Stripe.Invoice | null> {
    try {
      // ✅ SOLUTION v15+ : Utiliser list avec des filtres
      const invoices = await this.stripe.invoices.list({
        subscription: subscriptionId,
        status: 'draft',
        limit: 1,
      });

      // Retourner la première facture draft (upcoming)
      return invoices.data.length > 0 ? invoices.data[0] : null;
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to retrieve upcoming invoice for subscription ${subscriptionId}:`,
        error instanceof Error ? error.message : String(error),
      );
      return null; // Graceful fallback
    }
  }

  async getUpcomingInvoiceForCustomer(
    customerId: string,
    options: {
      subscription?: string;
      subscription_items?: Array<{
        id?: string;
        price?: string;
        quantity?: number;
      }>;
    } = {},
  ): Promise<Stripe.Invoice | null> {
    try {
      // ✅ SOLUTION v15+ : Créer une invoice preview
      const invoiceParams: Stripe.InvoiceCreateParams = {
        customer: customerId,
        auto_advance: false, // Ne pas finaliser automatiquement
      };

      if (options.subscription) {
        invoiceParams.subscription = options.subscription;
      }

      if (options.subscription_items) {
        // Ajouter des items à la facture
        invoiceParams.subscription = options.subscription;
      }

      const invoice = await this.stripe.invoices.create(invoiceParams);

      // Récupérer la facture avec les détails complets
      if (!invoice.id) {
        throw new Error('Failed to create invoice: missing invoice ID');
      }
      return await this.stripe.invoices.retrieve(invoice.id);
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to create preview invoice for customer ${customerId}:`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  async previewSubscriptionChange(
    subscriptionId: string,
    newPriceId: string,
    prorationDate?: number,
  ): Promise<Stripe.Invoice | null> {
    try {
      const subscription =
        await this.stripe.subscriptions.retrieve(subscriptionId);

      // ✅ SOLUTION v15+ : Créer une facture de preview
      const invoice = await this.stripe.invoices.create({
        customer: subscription.customer as string,
        subscription: subscriptionId,
        auto_advance: false,
        description: 'Preview for subscription change',
      });

      // Ajouter l'item avec le nouveau prix
      await this.stripe.invoiceItems.create({
        customer: subscription.customer as string,
        invoice: invoice.id,
        price_data: {
          currency: 'usd',
          product: subscription.items.data[0].price.product as string,
          unit_amount: subscription.items.data[0].price.unit_amount || 0,
        },
        quantity: 1,
      });

      // Finaliser pour calculer les montants
      if (!invoice.id) {
        throw new Error('Failed to finalize invoice: missing invoice ID');
      }
      return await this.stripe.invoices.finalizeInvoice(invoice.id);
    } catch (error: any) {
      this.logger.error(
        `❌ Failed to preview subscription change for ${subscriptionId}:`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  async getNextInvoiceAmount(subscriptionId: string): Promise<number | null> {
    try {
      const subscription =
        await this.stripe.subscriptions.retrieve(subscriptionId);

      // Calculer le montant basé sur le price actuel
      if (subscription.items.data.length > 0) {
        const price = subscription.items.data[0].price;
        return price.unit_amount || 0;
      }

      return null;
    } catch (error) {
      this.logger.error(
        `❌ Failed to get next invoice amount for ${subscriptionId}:`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  async hasUpcomingInvoice(subscriptionId: string): Promise<boolean> {
    try {
      const invoices = await this.stripe.invoices.list({
        subscription: subscriptionId,
        status: 'draft',
        limit: 1,
      });

      return invoices.data.length > 0;
    } catch (error) {
      return false;
    }
  }
  async payInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.pay(invoiceId);
      this.logger.log(`✅ Invoice paid: ${invoiceId}`);
      return invoice;
    } catch (error) {
      this.logger.error(
        `❌ Failed to pay invoice ${invoiceId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to pay Stripe invoice: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      return await this.stripe.invoices.retrieve(invoiceId, {
        expand: ['subscription', 'customer'],
      });
    } catch (error) {
      this.logger.error(
        `❌ Failed to retrieve invoice ${invoiceId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to retrieve Stripe invoice: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ════════════════════════════════════════════════════
  // 💳 PAYMENT METHODS - INCHANGÉ
  // ════════════════════════════════════════════════════

  async getPaymentMethods(
    customerId: string,
    type: 'card' | 'sepa_debit' = 'card',
  ): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type,
      });

      return paymentMethods.data;
    } catch (error) {
      this.logger.error(
        `❌ Failed to retrieve payment methods for customer ${customerId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to retrieve Stripe payment methods: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      this.logger.log(
        `✅ Default payment method set for customer ${customerId}`,
      );
      return customer;
    } catch (error) {
      this.logger.error(
        `❌ Failed to set default payment method for customer ${customerId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to set default Stripe payment method: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async detachPaymentMethod(
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod =
        await this.stripe.paymentMethods.detach(paymentMethodId);
      this.logger.log(`✅ Payment method detached: ${paymentMethodId}`);
      return paymentMethod;
    } catch (error) {
      this.logger.error(
        `❌ Failed to detach payment method ${paymentMethodId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Failed to detach Stripe payment method: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ════════════════════════════════════════════════════
  // 🔧 WEBHOOK HELPERS - INCHANGÉ
  // ════════════════════════════════════════════════════

  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      this.logger.error(
        '❌ Failed to construct webhook event:',
        error instanceof Error ? error.message : String(error),
      );
      throw new Error(
        `Invalid webhook signature: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ════════════════════════════════════════════════════
  // 📊 UTILITIES - INCHANGÉ
  // ════════════════════════════════════════════════════

  mapStripeStatusToSubscriptionStatus(
    stripeStatus: string,
  ): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      trialing: SubscriptionStatus.TRIALING,
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
    };

    return statusMap[stripeStatus] || SubscriptionStatus.ACTIVE;
  }

  formatAmountFromStripe(amount: number): number {
    return amount / 100;
  }

  formatAmountForStripe(amount: number): number {
    return Math.round(amount * 100);
  }

  getStripeInstance(): Stripe {
    return this.stripe;
  }
}
