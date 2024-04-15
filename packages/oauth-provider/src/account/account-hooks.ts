import { Client } from '../client/client.js'
import { DeviceId } from '../device/device-id.js'
import { ClientAuth, OAuthClientId } from '../token/token-store.js'
import { Awaitable } from '../util/awaitable.js'
import { Sub } from './account-store.js'
// https://github.com/typescript-eslint/typescript-eslint/issues/8902
// eslint-disable-next-line
import { AccountStore } from './account-store.js'

/**
 * Allows disabling the call to {@link AccountStore.addAuthorizedClient} based
 * on the account, client and clientAuth (not all these info are available to
 * the store method).
 */
export type AccountAddAuthorizedClient = (
  deviceId: DeviceId,
  account: Sub,
  clientId: OAuthClientId,
  data: {
    client: Client
    clientAuth: ClientAuth
  },
) => Awaitable<boolean>

export type AccountHooks = {
  onAccountAddAuthorizedClient?: AccountAddAuthorizedClient
}
