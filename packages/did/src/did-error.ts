import { Did } from './did.js'

export class DidError extends Error {
  constructor(
    public readonly did: string,
    message: string,
    public readonly code: string,
    public readonly status = 400,
    cause?: unknown,
  ) {
    super(message, { cause })
  }

  /**
   * For compatibility with common error handlers
   */
  get statusCode() {
    return this.status
  }

  override toString() {
    return `${this.constructor.name} ${this.code} (${this.did}): ${this.message}`
  }

  static from(cause: unknown, did: string): DidError {
    if (cause instanceof DidError) {
      return cause
    }

    const message =
      cause instanceof Error
        ? cause.message
        : typeof cause === 'string'
          ? cause
          : 'An unknown error occurred'

    return new DidError(did, message, 'did-unknown-error', 500, cause)
  }
}

export class InvalidDidError extends DidError {
  constructor(
    did: string,
    message: string,
    code = 'did-invalid',
    status = 400,
    cause?: unknown,
  ) {
    super(did, message, code, status, cause)
  }
}

export class DidResolutionError extends DidError {
  constructor(
    did: Did,
    message: string,
    code = 'did-resolution-error',
    status = 400,
    cause?: unknown,
  ) {
    super(did, message, code, status, cause)
  }

  static fromHttpError(err: Error, did: Did, status?: number) {
    status ??=
      (typeof (err as any)?.statusCode === 'number'
        ? (err as any).statusCode
        : undefined) ??
      (typeof (err as any)?.status === 'number'
        ? (err as any).status
        : undefined)

    return new DidResolutionError(
      did,
      err.message,
      'did-fetch-error',
      status,
      err,
    )
  }
}

export class DidDocumentFormatError extends DidError {
  constructor(
    did: Did,
    message: string,
    code = 'did-document-format-error',
    status = 503,
    cause?: unknown,
  ) {
    super(did, message, code, status, cause)
  }

  static fromValidationError(err: Error, did: Did) {
    return new DidDocumentFormatError(
      did,
      err.message,
      'did-document-validation-error',
      undefined,
      err,
    )
  }
}
