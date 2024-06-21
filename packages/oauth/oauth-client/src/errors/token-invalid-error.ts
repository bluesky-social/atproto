export class TokenInvalidError extends Error {
  constructor(
    public readonly sub: string,
    message = `The session for "${sub}" is invalid`,
    options?: { cause?: unknown },
  ) {
    super(message, options)
  }
}
