import { Module } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service.js';
import { StorageService } from './storage.service.js';

/** Binds StorageService to its implementation: the only place to change to store the files elsewhere (S3…). */
@Module({
  providers: [{ provide: StorageService, useClass: LocalStorageService }],
  exports: [StorageService],
})
export class StorageModule {}
