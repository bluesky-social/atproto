export class TokenRevokedError extends Error {
  constructor(
    public readonly sub: string,
    message = `The session for "${sub}" was successfully revoked`,
    options?: { cause?: unknown },
  ) {
    super(message, options)
  }
}
