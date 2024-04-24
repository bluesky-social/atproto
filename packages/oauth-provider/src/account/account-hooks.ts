import { Client } from '../client/client.js'
import { DeviceId } from '../device/device-id.js'
import { Awaitable } from '../lib/util/type.js'
import { ClientAuth } from '../token/token-store.js'
import { Account } from './account-store.js'
// https://github.com/typescript-eslint/typescript-eslint/issues/8902
// eslint-disable-next-line
import { AccountStore } from './account-store.js'

/**
 * Allows disabling the call to {@link AccountStore.addAuthorizedClient} based
 * on the account, client and clientAuth (not all these info are available to
 * the store method).
 */
export type AccountAddAuthorizedClient = (
  client: Client,
  data: {
    deviceId: DeviceId
    account: Account
    clientAuth: ClientAuth
  },
) => Awaitable<boolean>

export type AccountHooks = {
  onAccountAddAuthorizedClient?: AccountAddAuthorizedClient
}
