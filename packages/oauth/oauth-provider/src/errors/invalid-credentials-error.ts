import type { Did } from '@atproto/did'
import { InvalidRequestError } from './invalid-request-error.js'

/**
 * Thrown by {@link AccountStore.authenticateAccount} implementations to signal
 * that a sign-in attempt was rejected because the provided credentials did not
 * match a known account.
 *
 * When the identifier resolved to an existing account but e.g. the password or
 * OTP was incorrect, the {@link did} should be set to the account's did. The
 * identifier-unknown case should leave {@link did} unset.
 *
 * The {@link OAuthHooks.onSignInFailed} hook receives this error along with the
 * associated {@link did} if available. If you wish to transfer information
 * between the {@link AccountStore.authenticateAccount} store and the hook, you
 * can use a class that extends {@link InvalidCredentialsError} to transfer
 * additional information. Just make sure not to expose sensitive information
 * through the `toJSON` method.
 */
export class InvalidCredentialsError extends InvalidRequestError {
  constructor(
    public readonly did: Did | null,
    cause?: unknown,
  ) {
    super('Invalid identifier or password', cause)
  }
}
