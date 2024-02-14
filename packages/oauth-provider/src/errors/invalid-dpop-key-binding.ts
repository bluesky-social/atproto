import { InvalidTokenError } from './invalid-token-error.js'

export class InvalidDpopKeyBindingError extends InvalidTokenError {
  constructor(cause?: unknown) {
    super('Invalid DPoP key binding', { DPoP: {} }, cause)
  }
}
