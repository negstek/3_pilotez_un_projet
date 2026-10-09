import { ConfigService } from '@nestjs/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SerializedRequest, SerializedResponse } from 'pino';
import { logLevel, loggerParams, maskDownloadToken, requestId, serializeRequest, serializeResponse } from './logger.config.js';

const TOKEN = '3f2a9c1e-7b4d-4e8a-9f60-1c2d3e4f5a6b';

function fakeResponse(statusCode = 200) {
  const headers: Record<string, string> = {};
  const res = { statusCode, setHeader: (name: string, value: string) => (headers[name] = value) } as unknown as ServerResponse;
  return { res, headers };
}

describe('maskDownloadToken', () => {
  it('keeps only the first characters of the download token', () => {
    expect(maskDownloadToken(`/f/${TOKEN}`)).toBe('/f/3f2a9c1e…');
    expect(maskDownloadToken(`/f/${TOKEN}/download`)).toBe('/f/3f2a9c1e…/download');
  });

  it('leaves the other URLs untouched', () => {
    expect(maskDownloadToken('/files?status=all')).toBe('/files?status=all');
  });
});

describe('requestId', () => {
  it('reuses a well-formed X-Request-Id and sends it back', () => {
    const { res, headers } = fakeResponse();
    const req = { headers: { 'x-request-id': 'proxy-id-42' } } as unknown as IncomingMessage;

    expect(requestId(req, res)).toBe('proxy-id-42');
    expect(headers['X-Request-Id']).toBe('proxy-id-42');
  });

  it('generates a UUID when the header is missing or malformed', () => {
    const { res, headers } = fakeResponse();
    const req = { headers: { 'x-request-id': 'bad id\nwith a new line' } } as unknown as IncomingMessage;

    const id = requestId(req, res);

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers['X-Request-Id']).toBe(id);
  });
});

describe('serializeRequest', () => {
  it('keeps the listed fields only, never the Authorization header', () => {
    const req = {
      id: 'r1',
      method: 'POST',
      url: `/f/${TOKEN}/download`,
      remoteAddress: '127.0.0.1',
      headers: { authorization: 'Bearer secret', cookie: 'a=b', 'content-length': '42', 'user-agent': 'k6' },
    } as unknown as SerializedRequest;

    expect(serializeRequest(req)).toEqual({
      id: 'r1',
      method: 'POST',
      url: '/f/3f2a9c1e…/download',
      contentLength: '42',
      userAgent: 'k6',
      remoteAddress: '127.0.0.1',
    });
  });
});

describe('serializeResponse', () => {
  it('keeps the status and the size of the response', () => {
    const res = { statusCode: 200, headers: { 'content-length': '1024', 'x-powered-by': 'Express' } } as unknown as SerializedResponse;

    expect(serializeResponse(res)).toEqual({ statusCode: 200, contentLength: '1024' });
  });
});

describe('logLevel', () => {
  const req = {} as IncomingMessage;

  it.each([
    [200, 'info'],
    [401, 'warn'],
    [422, 'warn'],
    [500, 'error'],
  ])('logs a %i at level %s', (statusCode, level) => {
    expect(logLevel(req, fakeResponse(statusCode).res)).toBe(level);
  });

  it('logs an error whatever the status', () => {
    expect(logLevel(req, fakeResponse(200).res, new Error('boom'))).toBe('error');
  });
});

describe('loggerParams', () => {
  const params = (env: Record<string, string>) => loggerParams(new ConfigService(env));

  it('logs JSON at level info by default', () => {
    expect(params({}).pinoHttp).toMatchObject({ level: 'info', transport: undefined, quietReqLogger: true });
  });

  it('follows LOG_LEVEL and LOG_FORMAT', () => {
    expect(params({ LOG_LEVEL: 'silent', LOG_FORMAT: 'pretty' }).pinoHttp).toMatchObject({
      level: 'silent',
      transport: { target: 'pino-pretty' },
    });
  });
});
