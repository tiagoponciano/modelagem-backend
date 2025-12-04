import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilita validação automática (DTOs)
  app.useGlobalPipes(new ValidationPipe());

  // Habilita CORS (Permite que o Next.js acesse)
  app.enableCors();

  // Roda na porta 3001 (para não brigar com o Next.js 3000)
  await app.listen(3001);
}
bootstrap();
