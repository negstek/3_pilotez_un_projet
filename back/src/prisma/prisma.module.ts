import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * Exposes a single PrismaService (and therefore a single connection pool) to the whole application. Declared global because almost every
 * feature module needs database access, which avoids importing it everywhere.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
