import { UnauthorizedError } from './unauthorized-error.js'

export class UnauthorizedDpopError extends UnauthorizedError {
  constructor(cause?: unknown) {
    super('DPoP proof required', { DPoP: {} }, cause)
  }
}
