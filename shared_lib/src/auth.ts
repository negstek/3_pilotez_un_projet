// Bodies exchanged by the authentication routes. They mirror the schemas of docs/api-contract.yaml (`auth` tag), which remains the
// reference.

/** Public identity of an authenticated user (`GET /auth/me`, `user` field of AuthResponse). */
export interface AuthUser {
  id: string;
  email: string;
}

/** Response of both `POST /auth/register` and `POST /auth/login`. */
export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

/** Body of `POST /auth/register` and `POST /auth/login`. */
export interface Credentials {
  email: string;
  password: string;
}
