/**
 * Builds a fake, unsigned JWT for tests. Only its `exp` claim matters to the front, which never checks signatures (see session.ts).
 *
 * @param expiresInSeconds Negative to get an already expired token.
 */
export function fakeJwt(expiresInSeconds: number): string {
  // base64url encoding, as in a real JWT.
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
  return `${encode({ alg: 'HS256' })}.${encode({ sub: 'u1', exp })}.signature`
}
