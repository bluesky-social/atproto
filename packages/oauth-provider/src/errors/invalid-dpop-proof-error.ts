import { WWWAuthenticateError } from './www-authenticate-error.js'

export class InvalidDpopProofError extends WWWAuthenticateError {
  constructor(error_description: string, cause?: unknown) {
    const error = 'invalid_dpop_proof'
    super(
      error,
      error_description,
      { DPoP: { error, error_description } },
      cause,
    )
  }
}
