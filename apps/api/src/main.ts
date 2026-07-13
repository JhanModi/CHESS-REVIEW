import "reflect-metadata";
import { Logger, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.enableCors({
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Tempo API")
    .setDescription("Chess game analysis platform — REST API. All endpoints are versioned under /v1.")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swaggerConfig));

  // PORT is the platform-standard var (Render/Railway/Fly inject it);
  // API_PORT is our local-dev override.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  await app.listen(port);
  new Logger("Bootstrap").log(`Tempo API listening on :${port} (docs at /docs)`);
}

void bootstrap();
