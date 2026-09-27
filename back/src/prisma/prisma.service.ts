import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Prisma client injectable through Nest's dependency injection.
 *
 * Prisma 7 no longer embeds a query engine: it talks to PostgreSQL through a driver adapter, here `@prisma/adapter-pg` (node-postgres). The
 * connection URL comes from ConfigService rather than from the schema, so the e2e tests can point the same code at the test database.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
      }),
    });
  }

  /** Closes the connection pool on shutdown (app.close(), end of e2e tests). */
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
