export type LexErrorCode = string & NonNullable<unknown>

export type LexErrorData<N extends LexErrorCode = LexErrorCode> = {
  error: N
  message?: string
}

export class LexError<N extends LexErrorCode = LexErrorCode> extends Error {
  name = 'LexError'

  constructor(
    readonly error: N,
    message?: string, // Defaults to empty string in Error constructor
    options?: ErrorOptions,
  ) {
    super(message, options)
  }

  toString(): string {
    return `${this.name}: [${this.error}] ${this.message}`
  }

  toJSON(): LexErrorData<N> {
    const { error, message } = this
    return { error, message: message || undefined }
  }

  /**
   * Translate into an HTTP response for downstream clients.
   */
  toResponse(): Response {
    return Response.json(this.toJSON(), { status: 400 })
  }
}
