export abstract class FetchError extends Error {
  constructor(
    public readonly statusCode: number,
    message?: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }

  get expose() {
    return true
  }
}
