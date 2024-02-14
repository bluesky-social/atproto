import { OAuthError } from './oauth-error.js'

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc9449#section-8}
 */
export class UseDpopNonceError extends OAuthError {
  constructor(
    error_description = 'Authorization server requires nonce in DPoP proof',
    cause?: unknown,
  ) {
    super('use_dpop_nonce', error_description, 400, cause)
  }
}
