import type { AuthUser } from '@datashare/shared-lib';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard.js';

// Unit tests of the decision taken once Passport has run the JWT strategy (handleRequest). Passport itself is not executed: its outcome
// (user or `false`) and the request headers are given by hand. The real chain, token included, is covered by test/files.e2e-spec.ts.
describe('OptionalJwtAuthGuard', () => {
  const guard = new OptionalJwtAuthGuard();
  const alice: AuthUser = { id: 'u1', email: 'alice@test.fr' };

  /** Execution context of a request carrying these headers (Node lowercases header names). */
  const contextWith = (headers: Record<string, string>) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as unknown as ExecutionContext;

  it('returns the user of a valid token', () => {
    expect(guard.handleRequest(null, alice, undefined, contextWith({ authorization: 'Bearer valide' }))).toBe(alice);
  });

  it('lets a request without credentials through as anonymous (US07)', () => {
    expect(guard.handleRequest(null, false, undefined, contextWith({}))).toBeNull();
  });

  it.each([
    ['an expired or forged token', 'Bearer invalide'],
    ['another scheme', 'Basic YWxpY2U6c2VjcmV0'],
    ['an empty header', ''],
  ])('rejects %s with a 401 instead of treating the request as anonymous', (_case, authorization) => {
    expect(() => guard.handleRequest(null, false, undefined, contextWith({ authorization }))).toThrow(UnauthorizedException);
  });

  it('rethrows an error raised by the strategy, even without credentials', () => {
    const failure = new Error('strategy failure');

    expect(() => guard.handleRequest(failure, false, undefined, contextWith({}))).toThrow(failure);
  });
});
