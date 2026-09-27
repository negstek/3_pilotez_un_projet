import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma CLI configuration (migrate, generate). Since Prisma 7 the connection URL lives here instead of in schema.prisma. `dotenv/config`
// loads `.env` without overriding variables already set, which lets test/global-setup.ts point the CLI at the test database.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
