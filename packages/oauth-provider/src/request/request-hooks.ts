import { ClientAuth } from '../client/client-auth.js'
import { Client } from '../client/client.js'
import { AuthorizationParameters } from '../parameters/authorization-parameters.js'
import { Awaitable } from '../util/awaitable.js'

/**
 * Allows validating and modifying the authorization parameters before the
 * authorization request is processed.
 *
 * @throws {InvalidAuthorizationDetailsError}
 */
export type AuthorizationRequestHook = (
  this: null,
  parameters: AuthorizationParameters,
  data: {
    client: Client
    clientAuth: ClientAuth
  },
) => Awaitable<void>

export type RequestHooks = {
  onAuthorizationRequest?: AuthorizationRequestHook
}
