export class ScopeMissingError extends Error {
  name = 'ScopeMissingError'

  constructor(public readonly scope: string) {
    super(`Missing required scope: ${scope} (or equivalent)`)
  }
}
