export class OAuthResolverError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
  }
}
