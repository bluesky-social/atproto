import { Client } from '../client/client.js'
import { DeviceId } from '../device/device-id.js'
import { InvalidRequestError } from '../oauth-errors.js'
import { Sub } from '../oidc/sub.js'
import { ClientAuth } from '../token/token-store.js'
import { constantTime } from '../util/time.js'
import { AccountHooks } from './account-hooks.js'
import {
  Account,
  AccountInfo,
  AccountStore,
  LoginCredentials,
} from './account-store.js'

const TIMING_ATTACK_MITIGATION_DELAY = 400

export class AccountManager {
  constructor(
    protected readonly store: AccountStore,
    protected readonly hooks: AccountHooks,
  ) {}

  public async signIn(
    credentials: LoginCredentials,
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
    clientAuth: ClientAuth,
  ): Promise<void> {
    if (this.hooks.onAccountAddAuthorizedClient) {
      const shouldAdd = await this.hooks.onAccountAddAuthorizedClient(client, {
        deviceId,
        account,
        clientAuth,
      })
      if (!shouldAdd) return
    }

    await this.store.addAuthorizedClient(deviceId, account.sub, client.id)
  }

  public async list(deviceId: DeviceId): Promise<AccountInfo[]> {
    const results = await this.store.listDeviceAccounts(deviceId)
    return results.filter((result) => result.info.remembered)
  }
}
