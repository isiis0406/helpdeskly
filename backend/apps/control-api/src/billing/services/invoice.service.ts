import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { ControlPrismaService } from '../../prisma/control-prisma.service';
import { InvoiceStatus } from '.prisma/control';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private readonly controlPrisma: ControlPrismaService) {}

  // ════════════════════════════════════════════════════
  // 🔄 SYNCHRONISATION AVEC STRIPE
  // ════════════════════════════════════════════════════

  async syncInvoiceFromStripe(stripeInvoice: Stripe.Invoice): Promise<void> {
    try {
      const { tenantId, subscriptionId } = await this.resolveOwnership(
        stripeInvoice,
      );

      if (!tenantId) {
        this.logger.warn(
          `⚠️ No tenant found for invoice: ${stripeInvoice.id} (customer: ${String(
            stripeInvoice.customer,
          )})`,
        );
        return;
      }

      const invoiceNumber = this.getInvoiceNumber(stripeInvoice);
      const { start: periodStart, end: periodEnd } =
        this.extractPeriod(stripeInvoice);
      const dueDate = this.getDueDate(stripeInvoice);
      const { amount, tax, totalAmount } = this.computeAmounts(stripeInvoice);
      const status = this.mapStripeStatusToInvoiceStatus(stripeInvoice.status);

      await this.controlPrisma.invoice.upsert({
        where: { stripeInvoiceId: stripeInvoice.id },
        update: {
          status,
          amount,
          tax,
          totalAmount,
          currency: stripeInvoice.currency?.toUpperCase() || 'EUR',
          dueDate,
          paidDate: stripeInvoice.status === 'paid' ? new Date() : undefined,
          periodStart,
          periodEnd,
        },
        create: {
          stripeInvoiceId: stripeInvoice.id,
          invoiceNumber,
          tenantId,
          subscriptionId: subscriptionId || null,
          status,
          amount,
          tax,
          totalAmount,
          currency: stripeInvoice.currency?.toUpperCase() || 'EUR',
          issueDate: new Date((stripeInvoice.created || Date.now() / 1000) * 1000),
          dueDate,
          paidDate: stripeInvoice.status === 'paid' ? new Date() : null,
          periodStart,
          periodEnd,
        },
      });

      this.logger.log(`✅ Invoice synced: ${stripeInvoice.id}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to sync invoice ${stripeInvoice.id}:`,
        error instanceof Error ? error.message : String(error),
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
          status: InvoiceStatus.PAID,
          paidDate: new Date(),
        },
      });

      this.logger.log(
        `✅ Invoice marked as PAID: ${invoiceId} (pi: ${paymentIntentId})`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to mark invoice as PAID: ${invoiceId}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async markInvoiceAsFailed(
    invoiceId: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      await this.controlPrisma.invoice.update({
        where: { stripeInvoiceId: invoiceId },
        data: { status: InvoiceStatus.OVERDUE },
      });

      this.logger.warn(
        `⚠️ Invoice marked as OVERDUE: ${invoiceId} - ${errorMessage}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to mark invoice as OVERDUE: ${invoiceId}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async finalizeInvoice(invoiceId: string): Promise<void> {
    try {
      await this.controlPrisma.invoice.update({
        where: { stripeInvoiceId: invoiceId },
        data: { status: InvoiceStatus.PENDING },
      });
      this.logger.log(`✅ Invoice finalized (PENDING): ${invoiceId}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to finalize invoice: ${invoiceId}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // ════════════════════════════════════════════════════
  // 🔧 HELPERS PRIVÉS
  // ════════════════════════════════════════════════════

  private mapStripeStatusToInvoiceStatus(
    status: Stripe.Invoice.Status | null | undefined,
  ): InvoiceStatus {
    switch (status) {
      case 'paid':
        return InvoiceStatus.PAID;
      case 'void':
        return InvoiceStatus.CANCELED;
      case 'uncollectible':
        return InvoiceStatus.OVERDUE;
      case 'draft':
      case 'open':
      default:
        return InvoiceStatus.PENDING;
    }
  }

  private extractPeriod(invoice: Stripe.Invoice): { start: Date; end: Date } {
    const line = invoice.lines?.data?.[0];
    const start = line?.period?.start
      ? new Date(line.period.start * 1000)
      : new Date((invoice.created || Date.now() / 1000) * 1000);
    const end = line?.period?.end
      ? new Date(line.period.end * 1000)
      : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    return { start, end };
    }

  private getDueDate(invoice: Stripe.Invoice): Date {
    if (invoice.due_date) return new Date(invoice.due_date * 1000);
    const created = (invoice.created || Math.floor(Date.now() / 1000)) * 1000;
    return new Date(created + 14 * 24 * 60 * 60 * 1000);
  }

  private computeAmounts(invoice: Stripe.Invoice): {
    amount: number;
    tax: number;
    totalAmount: number;
  } {
    const total = (invoice.total ?? 0) / 100;
    const subtotal = (invoice.subtotal ?? total) / 100;
    const tax =
      (typeof invoice.tax === 'number'
        ? invoice.tax
        : invoice.total && invoice.subtotal
        ? invoice.total - invoice.subtotal
        : 0) / 100;
    return {
      amount: subtotal,
      tax: tax < 0 ? 0 : tax,
      totalAmount: total,
    };
  }

  private getInvoiceNumber(invoice: Stripe.Invoice): string {
    if (invoice.number) return String(invoice.number);
    const date = new Date((invoice.created || Date.now() / 1000) * 1000);
    const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(
      2,
      '0',
    )}`;
    const suffix = String(invoice.id).slice(-6).toUpperCase();
    return `INV-${yyyymm}-${suffix}`;
  }

  private async resolveOwnership(invoice: Stripe.Invoice): Promise<{
    tenantId: string | null;
    subscriptionId: string | null;
  }> {
    try {
      if (invoice.subscription) {
        const subscription = await this.controlPrisma.subscription.findUnique({
          where: { stripeSubscriptionId: invoice.subscription as string },
          select: { id: true, tenantId: true },
        });
        if (subscription) {
          return { tenantId: subscription.tenantId, subscriptionId: subscription.id };
        }
      }

      if (invoice.customer) {
        const tenant = await this.controlPrisma.tenant.findFirst({
          where: { stripeCustomerId: invoice.customer as string },
          select: { id: true },
        });
        if (tenant) return { tenantId: tenant.id, subscriptionId: null };
      }
    } catch (_) {}

    return { tenantId: null, subscriptionId: null };
  }
}
