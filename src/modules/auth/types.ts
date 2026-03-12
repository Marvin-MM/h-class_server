/** Types specific to the Auth module. */

/** Session data stored in Redis. */
export interface SessionData {
  readonly userId: string;
  readonly role: string;
  readonly email: string;
  readonly createdAt: string;
}

/** Result of a successful login. */
export interface LoginResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: AuthUserResponse;
  readonly sessionId: string;
}

/** User information returned in auth responses (never includes password). */
export interface AuthUserResponse {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: string;
  readonly emailVerified: boolean;
  readonly avatarUrl: string | null;
  readonly createdAt: Date;
}

/** Token pair for refresh operations. */
export interface TokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
}
