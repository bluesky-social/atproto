export class OAuthSessionError extends Error {
  constructor(
    public readonly sessionId: string,
    message = 'The session was revoked',
    options?: { cause?: unknown },
  ) {
    super(message, options)
  }
}
