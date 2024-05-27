export class OAuthResolverError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
  }

  static from(cause: unknown, message?: string): OAuthResolverError {
    if (cause instanceof OAuthResolverError) return cause
    return new OAuthResolverError(message ?? `Unable to resolve identity`, {
      cause,
    })
  }
}
