import { ClientAuth } from '../client/client-auth.js'
import { Client } from '../client/client.js'
import { DeviceId } from '../device/device-id.js'
import { InvalidRequestError } from '../oauth-errors.js'
import { Sub } from '../oidc/sub.js'
import { constantTime } from '../util/time.js'
import { AccountHooks } from './account-hooks.js'
import {
  AccountStore,
  DeviceAccount,
  LoginCredentials,
} from './account-store.js'
import { Account } from './account.js'

const TIMING_ATTACK_MITIGATION_DELAY = 400

export class AccountManager {
  constructor(
    protected readonly store: AccountStore,
    protected readonly hooks: AccountHooks,
  ) {}

  public async signIn(
    deviceId: DeviceId,
    credentials: LoginCredentials,
    remember: boolean,
  ): Promise<DeviceAccount> {
    const { account, secondFactors } = await constantTime(
      TIMING_ATTACK_MITIGATION_DELAY,
      async () => {
        const result = await this.store.authenticateAccount(credentials)
        if (result) return result

        throw new InvalidRequestError('Invalid credentials')
      },
    )

    const current = await this.store.readDeviceAccount(deviceId, account.sub)
    if (current && !current.data.secondFactorRequired) {
      return this.store.updateDeviceAccount(deviceId, account.sub, {
        remembered: remember,
        authenticatedAt: new Date(),
      })
    }

    if (!secondFactors?.length) {
      return this.store.upsertDeviceAccount(deviceId, account.sub, {
        ...current?.data,
        remembered: remember,
        authenticatedAt: new Date(),
        secondFactorRequired: false,
        authorizedClients: [],
      })
    }

    throw new Error('2FA not implemented')
  }

  public async get(deviceId: DeviceId, sub: Sub): Promise<DeviceAccount> {
    const result = await this.store.readDeviceAccount(deviceId, sub)
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
      const shouldAdd = await this.hooks.onAccountAddAuthorizedClient(
        deviceId,
        account.sub,
        client.id,
        { client, clientAuth },
      )
      if (!shouldAdd) return
    }

    // TODO: refactor to use "updateDeviceAccount"

    // await this.store.addAuthorizedClient(deviceId, account.sub, client.id)
  }

  public async listActiveSessions(deviceId: DeviceId) {
    const results = await this.store.listDeviceAccounts(deviceId)
    return results.filter(
      (result) => result.data.authenticatedAt != null && result.data.remembered,
    )
  }
}
