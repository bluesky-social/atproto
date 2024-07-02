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
   * For compatibility with error handlers in common HTTP frameworks.
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

    const status =
      (typeof cause?.['statusCode'] === 'number'
        ? cause['statusCode']
        : undefined) ??
      (typeof cause?.['status'] === 'number' ? cause['status'] : undefined)

    return new DidError(did, message, 'did-unknown-error', status, cause)
  }
}

export class InvalidDidError extends DidError {
  constructor(did: string, message: string, cause?: unknown) {
    super(did, message, 'did-invalid', 400, cause)
  }
}
