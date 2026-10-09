import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SerializedRequest, SerializedResponse } from 'pino';

/** Request id accepted from an `X-Request-Id` header (set by a reverse proxy, for instance); anything else is replaced by a new UUID. */
const REQUEST_ID_PATTERN = /^[\w-]{1,64}$/;

/** Characters of the download token kept in the logs: enough to tell links apart, far too few to guess one (8 of 32 hexadecimal digits). */
const TOKEN_PREFIX_LENGTH = 8;

/**
 * Shortens the download token of a `/f/<token>` URL. The token is the key of the link: logged in full, anyone reading the logs could
 * download every unprotected file, so only its first characters are kept, which is enough to trace the requests of one link.
 */
export function maskDownloadToken(url: string): string {
  return url.replace(/\/f\/([^/?]+)/, (_match, token: string) => `/f/${token.slice(0, TOKEN_PREFIX_LENGTH)}…`);
}

/**
 * Correlation id of the request, written on each of its log lines and sent back in `X-Request-Id`, so a user reporting an error can give
 * the id of their request.
 */
export function requestId(req: IncomingMessage, res: ServerResponse): string {
  const header = req.headers['x-request-id'];
  const id = typeof header === 'string' && REQUEST_ID_PATTERN.test(header) ? header : randomUUID();
  res.setHeader('X-Request-Id', id);
  return id;
}

/**
 * Fields of the request kept in the logs: an explicit list rather than the default serializer minus a few redacted paths, so that no new
 * header (Authorization, Cookie…) can ever leak. The body is never logged: it holds the passwords.
 */
export function serializeRequest(req: SerializedRequest) {
  return {
    id: req.id,
    method: req.method,
    url: maskDownloadToken(req.url),
    // Size of the upload, for the performance analysis (see PERF.md).
    contentLength: req.headers['content-length'],
    userAgent: req.headers['user-agent'],
    remoteAddress: req.remoteAddress,
  };
}

export function serializeResponse(res: SerializedResponse) {
  return { statusCode: res.statusCode, contentLength: res.headers['content-length'] };
}

/** 5xx are errors to investigate, 4xx are refused requests (wrong input, wrong password…), worth seeing but expected. */
export function logLevel(_req: IncomingMessage, res: ServerResponse, error?: Error): 'error' | 'warn' | 'info' {
  if (error || res.statusCode >= 500) return 'error';
  if (res.statusCode >= 400) return 'warn';
  return 'info';
}

/**
 * Structured logs (pino): one JSON line per event, with one line per HTTP request carrying its method, URL, status and duration
 * (`responseTime`, in ms). `LOG_LEVEL` sets the minimum level (`silent` in the e2e tests), `LOG_FORMAT=pretty` switches to a readable output
 * for development. See the note on structured logs in docs/architecture.md.
 */
export function loggerParams(config: ConfigService): Params {
  return {
    pinoHttp: {
      level: config.get<string>('LOG_LEVEL', 'info'),
      transport: config.get<string>('LOG_FORMAT') === 'pretty' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
      genReqId: requestId,
      // The logs written while handling a request (business events of the services) carry its id only (`reqId`), not the whole request:
      // the request line written at the end has it all.
      quietReqLogger: true,
      customLogLevel: logLevel,
      serializers: { req: serializeRequest, res: serializeResponse },
    },
  };
}
