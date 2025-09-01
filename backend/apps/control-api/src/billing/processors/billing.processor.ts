import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';

@Processor('billing')
@Injectable()
export class BillingProcessor extends WorkerHost {
  private readonly logger = new Logger(BillingProcessor.name);

  async process(): Promise<void> {
    // Placeholder: implémenter les tâches de facturation asynchrones ici
    this.logger.verbose('Billing queue job processed (placeholder)');
  }
}
