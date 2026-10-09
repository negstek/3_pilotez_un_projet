import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import type { Server } from 'node:http';
import { AppModule } from './app.module.js';
import { setupApp } from './setup-app.js';

/** Maximum duration of a request, long enough for a 1 GB upload on a slow connection (see below). */
const UPLOAD_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * Application entry point: builds the Nest application, applies the shared configuration and starts the HTTP server.
 */
async function bootstrap() {
  // Logs of the startup are held until pino is ready, so that they come out in JSON like the rest.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // Nest's own logs (startup, routes, Logger of the services) go through pino too.
  app.useLogger(app.get(Logger));
  setupApp(app);
  // Same configuration source as the rest of the back (.env through ConfigModule), rather than reading process.env directly.
  const config = app.get(ConfigService);
  // No CORS: the browser reaches the API on the front's own origin, under /api, through the Vite dev server proxy (and the reverse proxy
  // in production), which also terminates HTTPS. The API itself only listens in plain HTTP behind it.
  // Node aborts any request lasting more than 5 minutes (requestTimeout), which would cut a 1 GB upload below ~27 Mbit/s. One hour covers
  // a 1 GB upload down to ~2.5 Mbit/s. headersTimeout (60 s) is kept, so a client that never finishes its headers is still dropped.
  const server = app.getHttpServer() as Server;
  server.requestTimeout = UPLOAD_TIMEOUT_MS;
  // Environment variables are strings; listen() accepts "3000" as well as 3000.
  await app.listen(config.get<string>('PORT', '3000'));
}
await bootstrap();
