export class OAuthError extends Error {
  public expose: boolean

  constructor(
    public readonly error: string,
    public readonly error_description: string,
    public readonly status = 400,
    cause?: unknown,
  ) {
    super(error_description, { cause })

    Error.captureStackTrace?.(this, this.constructor)

    this.name = this.constructor.name
    this.expose = status < 500
  }

  get statusCode() {
    return this.status
  }

  toJSON() {
    return {
      error: this.error,
      error_description: this.error_description,
    }
  }
}
