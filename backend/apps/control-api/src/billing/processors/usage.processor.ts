import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';

@Processor('usage-tracking')
@Injectable()
export class UsageProcessor extends WorkerHost {
  private readonly logger = new Logger(UsageProcessor.name);

  async process(): Promise<void> {
    // Placeholder: implémenter l’agrégation / sync d’usage asynchrone ici
    this.logger.verbose('Usage-tracking queue job processed (placeholder)');
  }
}
