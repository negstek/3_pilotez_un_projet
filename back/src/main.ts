import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './setup-app.js';

/**
 * Application entry point: builds the Nest application, applies the shared configuration and starts the HTTP server.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  // Same configuration source as the rest of the back (.env through ConfigModule), rather than reading process.env directly.
  const config = app.get(ConfigService);
  // No CORS: the browser reaches the API on the front's own origin, under /api, through the Vite dev server proxy (and the reverse proxy
  // in production), which also terminates HTTPS. The API itself only listens in plain HTTP behind it.
  // Environment variables are strings; listen() accepts "3000" as well as 3000.
  await app.listen(config.get<string>('PORT', '3000'));
}
await bootstrap();
