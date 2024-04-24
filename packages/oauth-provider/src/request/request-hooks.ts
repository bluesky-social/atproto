import { ClientAuth } from '../client/client-auth.js'
import { Client } from '../client/client.js'
import { Awaitable } from '../lib/util/type.js'

/**
 * Non trusted clients will have reduced scopes, refresh token validity, and
 * will require user consent for authorization requests.
 */
export type IsFirstPartyClientHook = (
  this: null,
  client: Client,
  data: {
    clientAuth: ClientAuth
  },
) => Awaitable<boolean>

export type RequestHooks = {
  onIsFirstPartyClient?: IsFirstPartyClientHook
}
