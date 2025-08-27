import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { ControlPrismaService } from '../../prisma/control-prisma.service';
import { StripeService } from './stripe.service';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private controlPrisma: ControlPrismaService,
    private stripeService: StripeService,
  ) {}

  // ════════════════════════════════════════════════════
  // 🔄 SYNCHRONISATION AVEC STRIPE
  // ════════════════════════════════════════════════════

  async syncInvoiceFromStripe(stripeInvoice: Stripe.Invoice): Promise<void> {
    try {
      const tenantId = stripeInvoice.subscription
        ? await this.getTenantIdFromSubscription(
            typeof stripeInvoice.subscription === 'string'
              ? stripeInvoice.subscription
              : (stripeInvoice.subscription as any).id,
          )
        : await this.getTenantIdFromCustomer(stripeInvoice.customer as string);

      if (!tenantId) {
        this.logger.warn(`⚠️ No tenant found for invoice: ${stripeInvoice.id}`);
        return;
      }

      await this.controlPrisma.invoice.upsert({
        where: { stripeInvoiceId: stripeInvoice.id },
        update: {
          status: stripeInvoice.status || 'draft',
          amount: stripeInvoice.total / 100, // Convertir de centimes
          currency: stripeInvoice.currency,
          paidAt: stripeInvoice.status_transitions?.paid_at
            ? new Date(stripeInvoice.status_transitions.paid_at * 1000)
            : null,
          dueDate: stripeInvoice.due_date
            ? new Date(stripeInvoice.due_date * 1000)
            : null,
          metadata: stripeInvoice.metadata || {},
          updatedAt: new Date(),
        },
        create: {
          stripeInvoiceId: stripeInvoice.id,
          tenantId,
          subscriptionId: await this.getSubscriptionIdFromStripe(
            stripeInvoice.subscription as string,
          ),
          status: stripeInvoice.status || 'draft',
          amount: stripeInvoice.total / 100,
          currency: stripeInvoice.currency,
          dueDate: stripeInvoice.due_date
            ? new Date(stripeInvoice.due_date * 1000)
            : null,
          paidAt: stripeInvoice.status_transitions?.paid_at
            ? new Date(stripeInvoice.status_transitions.paid_at * 1000)
            : null,
          metadata: stripeInvoice.metadata || {},
        },
      });

      this.logger.log(`✅ Invoice synced: ${stripeInvoice.id}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to sync invoice ${stripeInvoice.id}:`,
        error,
      );
      throw error;
    }
  }

  async markInvoiceAsPaid(
    invoiceId: string,
    paymentIntentId: string,
  ): Promise<void> {
    try {
      await this.controlPrisma.invoice.update({
        where: { stripeInvoiceId: invoiceId },
        data: {
          status: 'paid',
          paidAt: new Date(),
          paymentIntentId,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`✅ Invoice marked as paid: ${invoiceId}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to mark invoice as paid: ${invoiceId}`,
        error,
      );
      throw error;
    }
  }

  async markInvoiceAsFailed(
    invoiceId: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      await this.controlPrisma.invoice.update({
        where: { stripeInvoiceId: invoiceId },
        data: {
          status: 'payment_failed',
          lastError: errorMessage,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`✅ Invoice marked as failed: ${invoiceId}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to mark invoice as failed: ${invoiceId}`,
        error,
      );
      throw error;
    }
  }

  async finalizeInvoice(invoiceId: string): Promise<void> {
    try {
      await this.controlPrisma.invoice.update({
        where: { stripeInvoiceId: invoiceId },
        data: {
          status: 'open',
          updatedAt: new Date(),
        },
      });

      this.logger.log(`✅ Invoice finalized: ${invoiceId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to finalize invoice: ${invoiceId}`, error);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════
  // 🔧 HELPERS PRIVÉS
  // ════════════════════════════════════════════════════

  private async getTenantIdFromSubscription(
    subscriptionId: string,
  ): Promise<string | null> {
    try {
      const subscription = await this.controlPrisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscriptionId },
        select: { tenantId: true },
      });

      return subscription?.tenantId || null;
    } catch (error) {
      return null;
    }
  }

  private async getTenantIdFromCustomer(
    customerId: string,
  ): Promise<string | null> {
    try {
      const tenant = await this.controlPrisma.tenant.findFirst({
        where: { stripeCustomerId: customerId },
        select: { id: true },
      });

      return tenant?.id || null;
    } catch (error) {
      return null;
    }
  }

  private async getSubscriptionIdFromStripe(
    stripeSubscriptionId: string,
  ): Promise<string | null> {
    if (!stripeSubscriptionId) return null;

    try {
      const subscription = await this.controlPrisma.subscription.findUnique({
        where: { stripeSubscriptionId },
        select: { id: true },
      });

      return subscription?.id || null;
    } catch (error) {
      return null;
    }
  }
}
