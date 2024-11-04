import { isOAuthClientIdLoopback } from '@atproto/oauth-types'
import { Client } from '../client/client.js'
import { DeviceId } from '../device/device-id.js'
import { constantTime } from '../lib/util/time.js'
import { InvalidRequestError } from '../oauth-errors.js'
import { Sub } from '../oidc/sub.js'
import { ClientAuth } from '../token/token-store.js'
import {
  Account,
  AccountInfo,
  AccountStore,
  SignInCredentials,
} from './account-store.js'

const TIMING_ATTACK_MITIGATION_DELAY = 400

export class AccountManager {
  constructor(protected readonly store: AccountStore) {}

  public async signIn(
    credentials: SignInCredentials,
    deviceId: DeviceId,
  ): Promise<AccountInfo> {
    return constantTime(TIMING_ATTACK_MITIGATION_DELAY, async () => {
      const result = await this.store.authenticateAccount(credentials, deviceId)
      if (result) return result

      throw new InvalidRequestError('Invalid credentials')
    })
  }

  public async get(deviceId: DeviceId, sub: Sub): Promise<AccountInfo> {
    const result = await this.store.getDeviceAccount(deviceId, sub)
    if (result) return result

    throw new InvalidRequestError(`Account not found`)
  }

  public async addAuthorizedClient(
    deviceId: DeviceId,
    account: Account,
    client: Client,
    _clientAuth: ClientAuth,
  ): Promise<void> {
    // "Loopback" clients are not distinguishable from one another.
    if (isOAuthClientIdLoopback(client.id)) return

    await this.store.addAuthorizedClient(deviceId, account.sub, client.id)
  }

  public async list(deviceId: DeviceId): Promise<AccountInfo[]> {
    const results = await this.store.listDeviceAccounts(deviceId)
    return results.filter((result) => result.info.remembered)
  }
}
