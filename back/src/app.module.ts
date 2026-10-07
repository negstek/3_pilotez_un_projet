import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { FilesModule } from './files/files.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

/**
 * Root module. Feature modules (AuthModule, FilesModule) are registered here; cross-cutting infrastructure is global.
 */
@Module({
  imports: [
    // Loads `.env` into ConfigService for every module. Variables already set in the process environment take precedence, which is how the
    // e2e tests inject the values from `.env.test`.
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    FilesModule,
  ],
})
export class AppModule {}
