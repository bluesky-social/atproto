import { ClientId } from '../client/client-id.js'
import { DeviceId } from '../device/device-id.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { Sub } from '../oidc/sub.js'
import { LoginCredentials, AccountStore, AccountInfo } from './account-store.js'
import { Account } from './account.js'

const TIMING_ATTACK_MITIGATION_DELAY = 400

export class AccountManager {
  constructor(protected readonly store: AccountStore) {}

  public async login(
    credentials: LoginCredentials,
    deviceId: DeviceId | null,
  ): Promise<Account> {
    const start = Date.now()
    try {
      const result = await this.store.authenticateAccount(credentials, deviceId)
      if (!result) throw new InvalidRequestError('Invalid credentials')
      return result
    } finally {
      // Mitigate timing attacks
      const delta = Date.now() - start
      if (delta < TIMING_ATTACK_MITIGATION_DELAY) {
        await new Promise((resolve) =>
          setTimeout(resolve, TIMING_ATTACK_MITIGATION_DELAY - delta),
        )
      } else {
        // Make sure we wait a multiple of TIMING_ATTACK_MITIGATION_DELAY
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            TIMING_ATTACK_MITIGATION_DELAY *
              Math.ceil(delta / TIMING_ATTACK_MITIGATION_DELAY),
          ),
        )
      }
    }
  }

  public async get(deviceId: DeviceId, sub: Sub): Promise<AccountInfo> {
    const result = await this.store.getDeviceAccount(deviceId, sub)
    if (!result) throw new InvalidRequestError(`Account not found`)
    return result
  }

  public async addAuthorizedClient(
    deviceId: DeviceId,
    sub: Sub,
    clientId: ClientId,
  ): Promise<void> {
    await this.store.addAuthorizedClient(deviceId, sub, clientId)
  }

  public async list(deviceId: DeviceId): Promise<AccountInfo[]> {
    const results = await this.store.listDeviceAccounts(deviceId)
    return results.filter((result) => result.info.remembered)
  }
}
