import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';

let cachedApp: any;

async function bootstrap() {
  if (cachedApp) {
    return cachedApp;
  }

  const express = require('express');
  const expressApp = express();

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    {
      logger: false,
    },
  );

  app.useGlobalPipes(new ValidationPipe());
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('AHP Backend API')
    .setDescription('API para análise de projetos usando o método AHP')
    .setVersion('1.0')
    .addTag('projects')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.init();
  cachedApp = expressApp;
  return expressApp;
}

// Para Vercel serverless - usar module.exports para compatibilidade
module.exports = async function handler(req: any, res: any) {
  const app = await bootstrap();
  app(req, res);
};

// Para desenvolvimento local
if (require.main === module) {
  (async () => {
    const app = await NestFactory.create(AppModule);

    app.useGlobalPipes(new ValidationPipe());
    app.enableCors();

    const config = new DocumentBuilder()
      .setTitle('AHP Backend API')
      .setDescription('API para análise de projetos usando o método AHP')
      .setVersion('1.0')
      .addTag('projects')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    await app.listen(process.env.PORT || 3001);
    console.log(
      `Application is running on: http://localhost:${process.env.PORT || 3001}`,
    );
  })();
}
