import { execSync } from 'node:child_process';
import { config } from 'dotenv';

/**
 * Runs once before the e2e suite: applies the Prisma migrations to the test database (`datashare_test`, from `.env.test`), creating it if
 * needed. Tests then empty the tables themselves, so development data is never touched. `migrate deploy` is used rather than `migrate
 * reset` because it never drops data and never prompts.
 */
export default function setup() {
  config({ path: '.env.test', override: true, quiet: true });
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
