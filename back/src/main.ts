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
  // The React SPA is served from another origin (Vite dev server on :8080), so the browser only lets it call the API if that origin is
  // explicitly allowed. CORS is configured here rather than in setupApp() because Supertest does not go through a browser and therefore
  // does not need it.
  app.enableCors({
    origin: config.get<string>('FRONT_URL', 'http://localhost:8080'),
  });
  // Environment variables are strings; listen() accepts "3000" as well as 3000.
  await app.listen(config.get<string>('PORT', '3000'));
}
await bootstrap();
