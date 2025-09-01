import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Counter, register } from 'prom-client';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { ControlPrismaService } from '../../prisma/control-prisma.service';
import { InvoiceService } from './invoice.service';
import { StripeService } from './stripe.service';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly webhookSecret: string;
  private readonly webhookCounter: Counter<string>;

  constructor(
    private configService: ConfigService,
    private prisma: ControlPrismaService,
    private stripeService: StripeService,
    private subscriptionService: SubscriptionService,
    private invoiceService: InvoiceService,
  ) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required');
    }

    this.webhookSecret = webhookSecret;

    // Prometheus counter for webhook events by type and outcome
    const existing = register.getSingleMetric('stripe_webhook_events_total') as
      | Counter<string>
      | undefined;
    this.webhookCounter =
      existing ||
      new Counter({
        name: 'stripe_webhook_events_total',
        help: 'Stripe webhook events processed',
        labelNames: ['type', 'outcome'],
      });
  }

  // ════════════════════════════════════════════════════
  // 🎯 TRAITEMENT PRINCIPAL DU WEBHOOK
  // ════════════════════════════════════════════════════

  async handleWebhook(
    payload: string | Buffer,
    signature: string,
  ): Promise<{ received: boolean }> {
    try {
      const event = this.stripeService.constructWebhookEvent(
        payload,
        signature,
        this.webhookSecret,
      );

      this.logger.log(`📨 Webhook received: ${event.type} - ${event.id}`);

      // Vérifier si l'événement a déjà été traité
      if (await this.isEventProcessed(event.id)) {
        this.logger.warn(`⚠️ Event ${event.id} already processed, skipping`);
        return { received: true };
      }

      // Traiter l'événement selon son type
      await this.processEvent(event);

      // Marquer l'événement comme traité
      await this.markEventAsProcessed(event);

      this.logger.log(`✅ Webhook processed successfully: ${event.type}`);
      this.webhookCounter.labels(event.type, 'processed').inc(1);
      return { received: true };
    } catch (error) {
      this.logger.error(
        `❌ Webhook processing failed:`,
        error instanceof Error ? error.message : String(error),
      );
      try {
        // best effort to parse event type from body if available
        const type = (error as any)?.raw?.type || 'unknown';
        this.webhookCounter.labels(type, 'failed').inc(1);
      } catch {}
      throw new BadRequestException('Webhook processing failed');
    }
  }

  // ════════════════════════════════════════════════════
  // 🔄 TRAITEMENT DES ÉVÉNEMENTS
  // ════════════════════════════════════════════════════

  private async processEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      // Événements d'abonnement
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.trial_will_end':
        await this.handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      // Événements de facture
      case 'invoice.created':
        await this.handleInvoiceCreated(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice,
        );
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
        );
        break;

      case 'invoice.finalized':
        await this.handleInvoiceFinalized(event.data.object as Stripe.Invoice);
        break;

      // Événements de paiement
      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      // Événements client
      case 'customer.created':
        await this.handleCustomerCreated(event.data.object as Stripe.Customer);
        break;

      case 'customer.updated':
        await this.handleCustomerUpdated(event.data.object as Stripe.Customer);
        break;

      case 'customer.deleted':
        await this.handleCustomerDeleted(event.data.object as Stripe.Customer);
        break;

      default:
        this.logger.log(`🔄 Unhandled event type: ${event.type}`);
    }
  }

  // ════════════════════════════════════════════════════
  // 📋 HANDLERS D'ABONNEMENT
  // ════════════════════════════════════════════════════

  private async handleSubscriptionCreated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;

    if (!tenantId) {
      this.logger.warn(
        `⚠️ No tenantId in subscription metadata: ${subscription.id}`,
      );
      return;
    }

    try {
      await this.subscriptionService.syncSubscriptionFromStripe(subscription);
      this.logger.log(
        `✅ Subscription created: ${subscription.id} for tenant: ${tenantId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to sync created subscription: ${subscription.id}`,
        error,
      );
    }
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;

    if (!tenantId) {
      this.logger.warn(
        `⚠️ No tenantId in subscription metadata: ${subscription.id}`,
      );
      return;
    }

    try {
      await this.subscriptionService.syncSubscriptionFromStripe(subscription);

      // Gérer les changements de statut spéciaux
      if (subscription.status === 'past_due') {
        await this.handleSubscriptionPastDue(subscription);
      } else if (subscription.cancel_at_period_end) {
        await this.handleSubscriptionCancellationScheduled(subscription);
      }

      this.logger.log(`✅ Subscription updated: ${subscription.id}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to sync updated subscription: ${subscription.id}`,
        error,
      );
    }
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;

    if (!tenantId) {
      this.logger.warn(
        `⚠️ No tenantId in subscription metadata: ${subscription.id}`,
      );
      return;
    }

    try {
      await this.subscriptionService.handleSubscriptionCanceled(
        tenantId,
        subscription.id,
      );
      this.logger.log(`✅ Subscription deleted: ${subscription.id}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to handle deleted subscription: ${subscription.id}`,
        error,
      );
    }
  }

  private async handleTrialWillEnd(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;

    if (!tenantId) return;

    try {
      // Envoyer notification de fin d'essai
      await this.notifyTrialEnding(tenantId, subscription);
      this.logger.log(
        `✅ Trial ending notification sent for: ${subscription.id}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to send trial ending notification: ${subscription.id}`,
        error,
      );
    }
  }

  // ════════════════════════════════════════════════════
  // 🧾 HANDLERS DE FACTURE
  // ════════════════════════════════════════════════════

  private async handleInvoiceCreated(invoice: Stripe.Invoice): Promise<void> {
    try {
      await this.invoiceService.syncInvoiceFromStripe(invoice);
      this.logger.log(`✅ Invoice created: ${invoice.id}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to sync created invoice: ${invoice.id}`,
        error,
      );
    }
  }

  private async handleInvoicePaymentSucceeded(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    try {
      await this.invoiceService.markInvoiceAsPaid(
        invoice.id,
        invoice.payment_intent as string,
      );

      // Si c'est la première facture, activer l'abonnement
      if (invoice.subscription) {
        await this.subscriptionService.activateSubscriptionAfterPayment(
          invoice.subscription as string,
        );
      }

      this.logger.log(`✅ Invoice payment succeeded: ${invoice.id}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to handle successful payment: ${invoice.id}`,
        error,
      );
    }
  }

  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    try {
      await this.invoiceService.markInvoiceAsFailed(
        invoice.id,
        invoice.last_finalization_error?.message || 'Payment failed',
      );

      // Notifier l'échec de paiement
      if (invoice.subscription) {
        await this.notifyPaymentFailed(invoice);
      }

      this.logger.log(`✅ Invoice payment failed handled: ${invoice.id}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to handle failed payment: ${invoice.id}`,
        error,
      );
    }
  }

  private async handleInvoiceFinalized(invoice: Stripe.Invoice): Promise<void> {
    try {
      await this.invoiceService.finalizeInvoice(invoice.id);
      this.logger.log(`✅ Invoice finalized: ${invoice.id}`);
    } catch (error) {
      this.logger.error(`❌ Failed to finalize invoice: ${invoice.id}`, error);
    }
  }

  // ════════════════════════════════════════════════════
  // 💳 HANDLERS DE PAIEMENT
  // ════════════════════════════════════════════════════

  private async handlePaymentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    try {
      // Logger le succès du paiement
      this.logger.log(
        `✅ Payment succeeded: ${paymentIntent.id} - ${paymentIntent.amount / 100}`,
      );

      // Mettre à jour les métriques de paiement si nécessaire
      await this.updatePaymentMetrics(paymentIntent);
    } catch (error) {
      this.logger.error(
        `❌ Failed to handle payment success: ${paymentIntent.id}`,
        error,
      );
    }
  }

  private async handlePaymentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    try {
      this.logger.warn(
        `⚠️ Payment failed: ${paymentIntent.id} - ${paymentIntent.last_payment_error?.message}`,
      );

      // Traiter l'échec selon le contexte (setup, subscription, etc.)
      await this.processPaymentFailure(paymentIntent);
    } catch (error) {
      this.logger.error(
        `❌ Failed to handle payment failure: ${paymentIntent.id}`,
        error,
      );
    }
  }

  // ════════════════════════════════════════════════════
  // 👤 HANDLERS CLIENT
  // ════════════════════════════════════════════════════

  private async handleCustomerCreated(
    customer: Stripe.Customer,
  ): Promise<void> {
    const tenantId = customer.metadata?.tenantId;

    if (!tenantId) return;

    try {
      // Synchroniser les informations client avec la DB
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          stripeCustomerId: customer.id,
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `✅ Customer created: ${customer.id} for tenant: ${tenantId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to sync created customer: ${customer.id}`,
        error,
      );
    }
  }

  private async handleCustomerUpdated(
    customer: Stripe.Customer,
  ): Promise<void> {
    const tenantId = customer.metadata?.tenantId;

    if (!tenantId) return;

    try {
      // Synchroniser les mises à jour client
      await this.syncCustomerUpdates(customer, tenantId);
      this.logger.log(`✅ Customer updated: ${customer.id}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to sync updated customer: ${customer.id}`,
        error,
      );
    }
  }

  private async handleCustomerDeleted(
    customer: Stripe.Customer,
  ): Promise<void> {
    const tenantId = customer.metadata?.tenantId;

    if (!tenantId) return;

    try {
      // Nettoyer les références au customer supprimé
      await this.cleanupDeletedCustomer(customer, tenantId);
      this.logger.log(`✅ Customer deleted: ${customer.id}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to cleanup deleted customer: ${customer.id}`,
        error,
      );
    }
  }

  // ════════════════════════════════════════════════════
  // 🔧 HELPERS PRIVÉS
  // ════════════════════════════════════════════════════

  private async isEventProcessed(eventId: string): Promise<boolean> {
    try {
      const anyPrisma = this.prisma as any;
      if (anyPrisma.webhookEvent) {
        const existing = await anyPrisma.webhookEvent.findUnique({
          where: { stripeEventId: eventId },
        });
        if (existing) {
          this.webhookCounter.labels('unknown', 'duplicate').inc(1);
        }
        return !!existing;
      }

      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        'SELECT 1 FROM webhook_events WHERE stripe_event_id = $1 LIMIT 1',
        eventId,
      );
      if (rows.length > 0) this.webhookCounter.labels('unknown', 'duplicate').inc(1);
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  private async markEventAsProcessed(event: Stripe.Event): Promise<void> {
    try {
      const anyPrisma = this.prisma as any;
      if (anyPrisma.webhookEvent) {
        await anyPrisma.webhookEvent.create({
          data: {
            stripeEventId: event.id,
            eventType: event.type,
            processed: true,
            processedAt: new Date(),
            eventData: event.data.object as any,
          },
        });
        return;
      }

      // Fallback SQL si le client typé n'est pas à jour
      await this.prisma.$executeRawUnsafe(
        'INSERT INTO webhook_events (id, stripe_event_id, event_type, processed, processed_at, event_data, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), $5::jsonb, NOW(), NOW())',
        event.id, // réutilise l'id stripe comme PK en fallback
        event.id,
        event.type,
        true,
        JSON.stringify(event.data.object || {}),
      );
    } catch (e) {
      this.logger.warn(
        `Failed to persist webhook event ${event.id} (table missing?): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  private async handleSubscriptionPastDue(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;
    if (!tenantId) return;

    // Implémenter la logique de gestion des retards de paiement
    // Par exemple: envoyer des notifications, limiter l'accès, etc.
    this.logger.warn(
      `⚠️ Subscription past due: ${subscription.id} for tenant: ${tenantId}`,
    );
  }

  private async handleSubscriptionCancellationScheduled(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;
    if (!tenantId) return;

    // Notifier de l'annulation programmée
    this.logger.log(
      `📅 Subscription cancellation scheduled: ${subscription.id} for tenant: ${tenantId}`,
    );
  }

  private async notifyTrialEnding(
    tenantId: string,
    subscription: Stripe.Subscription,
  ): Promise<void> {
    // TODO: Implémenter les notifications (email, in-app, etc.)
    this.logger.log(`📧 Trial ending notification for tenant: ${tenantId}`);
  }

  private async notifyPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    // TODO: Implémenter les notifications d'échec de paiement
    this.logger.log(
      `📧 Payment failed notification for invoice: ${invoice.id}`,
    );
  }

  private async updatePaymentMetrics(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    // TODO: Mettre à jour les métriques de paiement
    this.logger.log(`📊 Updating payment metrics for: ${paymentIntent.id}`);
  }

  private async processPaymentFailure(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    // TODO: Traiter les échecs de paiement selon le contexte
    this.logger.log(`🔄 Processing payment failure: ${paymentIntent.id}`);
  }

  private async syncCustomerUpdates(
    customer: Stripe.Customer,
    tenantId: string,
  ): Promise<void> {
    // TODO: Synchroniser les mises à jour client
    this.logger.log(`🔄 Syncing customer updates: ${customer.id}`);
  }

  private async cleanupDeletedCustomer(
    customer: Stripe.Customer,
    tenantId: string,
  ): Promise<void> {
    // TODO: Nettoyer les références au customer supprimé
    this.logger.log(`🧹 Cleaning up deleted customer: ${customer.id}`);
  }
}
