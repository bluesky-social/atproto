export class TokenRefreshError extends Error {
  constructor(
    public readonly sub: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
  }
}
