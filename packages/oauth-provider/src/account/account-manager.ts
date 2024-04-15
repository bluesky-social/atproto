import { OAuthClientId } from '@atproto/oauth-client-metadata'
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
    if (current && !current.data.secondFactor) {
      return this.store.updateDeviceAccount(deviceId, account.sub, {
        remembered: remember,
        authenticatedAt: new Date(),
      })
    }

    if (!secondFactors?.length) {
      return this.store.upsertDeviceAccount(deviceId, account.sub, {
        remembered: remember,
        authenticatedAt: new Date(),
        secondFactor: null,
        authorizedClients: current?.data.authorizedClients || [],
      })
    }

    return this.store.upsertDeviceAccount(deviceId, account.sub, {
      remembered: remember,
      authenticatedAt: new Date(),
      secondFactor: {
        methods: secondFactors,
      },
      authorizedClients: current?.data.authorizedClients || [],
    })
  }

  public async getAuthenticated(
    deviceId: DeviceId,
    sub: Sub,
  ): Promise<DeviceAccount> {
    const result = await this.store.readDeviceAccount(deviceId, sub)

    if (!result) {
      throw new InvalidRequestError(`Account not found`)
    }

    if (result.data.secondFactor) {
      throw new InvalidRequestError(`Second factor required`)
    }

    return result
  }

  public async setAuthorizedClients(
    deviceId: DeviceId,
    sub: Sub,
    authorizedClients: OAuthClientId[],
  ): Promise<void> {
    await this.store.updateDeviceAccount(deviceId, sub, { authorizedClients })
  }

  public async listActiveSessions(deviceId: DeviceId) {
    const results = await this.store.listDeviceAccounts(deviceId)
    return results.filter(
      (result) => result.data.remembered && result.data.secondFactor === null,
    )
  }
}
