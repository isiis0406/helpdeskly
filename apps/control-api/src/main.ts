// apps/control-api/src/main.ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🔧 AJOUT : Validation globale OBLIGATOIRE
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les propriétés non déclarées
      forbidNonWhitelisted: true, // Erreur si propriétés non autorisées
      transform: true, // Transforme les types automatiquement
      disableErrorMessages: false, // Garde les messages d'erreur
      validateCustomDecorators: true, // Valide les décorateurs personnalisés
    }),
  );

  await app.listen(process.env.CONTROL_PORT ?? 6500);
  console.log(`Control API is running on: ${await app.getUrl()}`);
}
bootstrap().catch((err) => console.error(err));
