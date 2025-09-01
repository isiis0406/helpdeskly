import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');
  // Application context only (no HTTP server)
  await NestFactory.createApplicationContext(AppModule);
  logger.log('BullMQ worker started (processors registered)');
}

bootstrap();

