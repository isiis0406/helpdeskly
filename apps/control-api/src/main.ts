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

  // Configuration Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Helpdeskly Control API')
    .setDescription(
      `
      API de contrôle pour la gestion multi-tenant de Helpdeskly.
      
      Cette API permet de :
      - 🔐 Gérer l'authentification centralisée
      - 🏢 Créer et gérer les tenants
      - 👥 Gérer les utilisateurs et leurs appartenances
      - 🚀 Provisionner automatiquement les bases de données tenant
      
      ## Authentification
      Utilisez le token JWT obtenu via /auth/login dans l'en-tête Authorization: Bearer <token>
      
      ## Architecture Multi-tenant
      - Control API : Gestion centralisée (cette API)
      - App API : API métier par tenant
    `,
    )
    .setVersion('1.0')
    .setContact(
      'Équipe Helpdeskly',
      'https://helpdeskly.com',
      'support@helpdeskly.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Token JWT obtenu via /auth/login',
        in: 'header',
      },
      'JWT-auth', // Nom de référence pour la sécurité
    )
    .addTag('Auth', 'Authentification et gestion des sessions')
    .addTag('Tenants', 'Gestion des tenants (espaces de travail)')
    .addTag('Users', 'Gestion des utilisateurs')
    .addTag('Health', "Points de santé de l'API")
    .addServer('http://localhost:3001', 'Environnement de développement')
    .addServer('https://control-api.helpdeskly.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2563eb }
    `,
    customSiteTitle: 'Helpdeskly Control API Docs',
  });

  const port = config.get('CONTROL_PORT') || 6500;
  await app.listen(port);

  logger.log(`🚀 Control API started on http://localhost:${port}`);
  logger.log(`📚 Swagger docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
