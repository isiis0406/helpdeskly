import { Controller, Get, Header } from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';

let metricsInitialized = false;

@Controller('metrics')
export class PrometheusController {
  constructor() {
    if (!metricsInitialized) {
      collectDefaultMetrics({ prefix: 'control_api_' });
      metricsInitialized = true;
    }
  }

  @Get()
  @Header('Content-Type', register.contentType)
  async metrics(): Promise<string> {
    return await register.metrics();
  }
}

