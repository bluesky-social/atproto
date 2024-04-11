import { ClientAuth } from '../client/client-auth.js'
import { Client } from '../client/client.js'
import { AuthorizationParameters } from '../parameters/authorization-parameters.js'
import { Awaitable } from '../util/awaitable.js'

/* eslint-disable @typescript-eslint/no-unused-vars */
import type { InvalidAuthorizationDetailsError } from '../errors/invalid-authorization-details-error.js'
import type { AccessDeniedError } from '../errors/access-denied-error.js'
import type { AccountSelectionRequiredError } from '../errors/account-selection-required-error.js'
import type { ConsentRequiredError } from '../errors/consent-required-error.js'
import type { InvalidParametersError } from '../errors/invalid-parameters-error.js'
import type { LoginRequiredError } from '../errors/login-required-error.js'
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * Allows validating and modifying the authorization parameters before the
 * authorization request is processed.
 *
 * @see {@link InvalidAuthorizationDetailsError}
 * @see {@link AccessDeniedError}
 * @see {@link AccountSelectionRequiredError}
 * @see {@link ConsentRequiredError}
 * @see {@link InvalidParametersError}
 * @see {@link LoginRequiredError}
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
