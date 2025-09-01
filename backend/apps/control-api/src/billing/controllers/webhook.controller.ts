import { Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebhookService } from '../services/webhook.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  // Endpoint pour recevoir les webhooks Stripe
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook receiver' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleStripeWebhook(@Req() req: any, @Headers('stripe-signature') signature: string) {
    const body = req.body; // raw Buffer configuré dans main.ts
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    return this.webhookService.handleWebhook(payload, signature);
  }
}
