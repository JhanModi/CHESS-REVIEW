import "reflect-metadata";
import { Logger, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import helmet from "helmet";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  // Security headers. CSP is off because this is a JSON API plus the Swagger
  // UI at /docs (which needs inline assets); CORP is cross-origin so the web
  // app (served with COEP: credentialless) can read API responses.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(compression());

  // WEB_URL may be a comma-separated allowlist (production + preview origins).
  const origins = (process.env.WEB_URL ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
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
