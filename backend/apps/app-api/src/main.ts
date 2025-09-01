import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Configuration globale
  app.setGlobalPrefix('api/v1');

  // Validation globale
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS
  app.enableCors({
    origin: config.get('FRONTEND_URL') || 'http://localhost:3000',
    credentials: true,
  });

  // ✅ Configuration Swagger simple et efficace
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Helpdeskly App API')
    .setDescription('API applicative pour la gestion des tickets multi-tenant')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Tenant-Slug',
        in: 'header',
        description: 'Slug du tenant pour le contexte multi-tenant',
      },
      'tenant-slug',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  const port = config.get('APP_PORT') || 9500;
  await app.listen(port);

  logger.log(`🎫 App API started on http://localhost:${port}`);
  logger.log(`📚 Swagger docs available at http://localhost:${port}/api`);
}

bootstrap();
