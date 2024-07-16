export type ErrorOptions = { cause?: unknown }

export const ERR_JWKS_NO_MATCHING_KEY = 'ERR_JWKS_NO_MATCHING_KEY'
export const ERR_JWK_INVALID = 'ERR_JWK_INVALID'
export const ERR_JWK_NOT_FOUND = 'ERR_JWK_NOT_FOUND'
export const ERR_JWT_INVALID = 'ERR_JWT_INVALID'
export const ERR_JWT_CREATE = 'ERR_JWT_CREATE'
export const ERR_JWT_VERIFY = 'ERR_JWT_VERIFY'

export class JwkError extends TypeError {
  constructor(
    message = 'JWK error',
    public readonly code = ERR_JWK_INVALID,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

export class JwtCreateError extends Error {
  constructor(
    message = 'Unable to create JWT',
    public readonly code = ERR_JWT_CREATE,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }

  static from(cause: unknown, code?: string, message?: string): JwtCreateError {
    if (cause instanceof JwtCreateError) return cause
    if (cause instanceof JwkError) {
      return new JwtCreateError(message, cause.code, { cause })
    }

    return new JwtCreateError(message, code, { cause })
  }
}

export class JwtVerifyError extends Error {
  constructor(
    message = 'Invalid JWT',
    public readonly code = ERR_JWT_VERIFY,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }

  static from(cause: unknown, code?: string, message?: string): JwtVerifyError {
    if (cause instanceof JwtVerifyError) return cause
    if (cause instanceof JwkError) {
      return new JwtVerifyError(message, cause.code, { cause })
    }

    return new JwtVerifyError(message, code, { cause })
  }
}
