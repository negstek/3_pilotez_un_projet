import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';

/** Persistence of user accounts; consumed by AuthModule. */
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
