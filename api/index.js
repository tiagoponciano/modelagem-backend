"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const platform_express_1 = require("@nestjs/platform-express");
let cachedApp;
async function bootstrap() {
    if (cachedApp) {
        return cachedApp;
    }
    const express = require('express');
    const expressApp = express();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_express_1.ExpressAdapter(expressApp), {
        logger: false,
    });
    app.useGlobalPipes(new common_1.ValidationPipe());
    app.enableCors();
    const config = new swagger_1.DocumentBuilder()
        .setTitle('AHP Backend API')
        .setDescription('API para análise de projetos usando o método AHP')
        .setVersion('1.0')
        .addTag('projects')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api', app, document);
    await app.init();
    cachedApp = expressApp;
    return expressApp;
}
module.exports = async function handler(req, res) {
    const app = await bootstrap();
    app(req, res);
};
//# sourceMappingURL=index.js.map