import { FILE_MESSAGES, FILE_STATUS_FILTERS, type FileStatusFilter } from '@datashare/shared-lib';
import { IsIn } from 'class-validator';

/**
 * Query string of GET /files (US05). The `tag` filter of the contract comes with the tags (US08); until then, the global ValidationPipe
 * strips it like any undeclared parameter.
 */
export class ListFilesQueryDto {
  // US06: "seuls les fichiers non expirés sont affichés par défaut dans l'historique". The initializer applies when the parameter is absent.
  @IsIn(FILE_STATUS_FILTERS, { message: FILE_MESSAGES.statusFilterInvalid })
  status: FileStatusFilter = 'active';
}
