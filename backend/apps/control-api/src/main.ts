import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { raw } from 'express';
import helmet from 'helmet';

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

  // Security headers (minimal Helmet-like)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    if ((req.protocol || '').toLowerCase() === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Helmet (standard headers + sensible defaults)
  app.use(helmet());

  // ✅ Configuration Swagger comme dans ton projet
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Helpdeskly Control API')
    .setDescription(
      'API de contrôle pour la gestion multi-tenant de Helpdeskly',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token', // ✅ Même nom que ton projet
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document); // ✅ Même path que ton projet

  const port = config.get('CONTROL_PORT') || 6500;
  await app.listen(port);

  logger.log(`🚀 Control API started on http://localhost:${port}`);
  logger.log(`📚 Swagger docs available at http://localhost:${port}/api`);
  // Stripe webhook doit utiliser le body RAW pour la signature
  app.use('/webhooks/stripe', raw({ type: 'application/json' }));
}

bootstrap();
