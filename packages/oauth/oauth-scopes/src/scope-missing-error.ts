export class ScopeMissingError extends Error {
  name = 'ScopeMissingError'

  // compatibility layer with http-errors package. The goal if to make
  // isHttpError(new ScopeMissingError) return true.
  status = 403
  expose = true
  get statusCode() {
    return this.status
  }

  constructor(public readonly scope: string) {
    super(`Missing required scope "${scope}"`)
  }
}
