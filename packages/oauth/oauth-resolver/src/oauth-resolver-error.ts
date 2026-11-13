import { ZodError } from 'zod'

export class OAuthResolverError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
  }

  static from(cause: unknown, message?: string): OAuthResolverError {
    if (cause instanceof OAuthResolverError) return cause
    const validationReason =
      cause instanceof ZodError
        ? `${cause.errors[0].path} ${cause.errors[0].message}`
        : null
    const fullMessage =
      (message ?? `Unable to resolve identity`) +
      (validationReason ? ` (${validationReason})` : '')
    return new OAuthResolverError(fullMessage, {
      cause,
    })
  }
}
