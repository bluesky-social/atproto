import { isOAuthClientIdLoopback } from '@atproto/oauth-types'
import { Client } from '../client/client.js'
import { DeviceId } from '../device/device-id.js'
import { callAsync } from '../lib/util/function.js'
import { constantTime } from '../lib/util/time.js'
import { InvalidRequestError } from '../oauth-errors.js'
import { OAuthHooks, RequestMetadata } from '../oauth-hooks.js'
import { Sub } from '../oidc/sub.js'
import { ClientAuth } from '../token/token-store.js'
import {
  Account,
  AccountInfo,
  AccountStore,
  ResetPasswordConfirmData,
  ResetPasswordRequestData,
  SignInData,
  SignUpData,
} from './account-store.js'

const TIMING_ATTACK_MITIGATION_DELAY = 400

export class AccountManager {
  constructor(
    protected readonly store: AccountStore,
    protected readonly hooks: OAuthHooks,
  ) {}

  public async signUp(
    data: SignUpData,
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
  ): Promise<AccountInfo> {
    return constantTime(TIMING_ATTACK_MITIGATION_DELAY, async () => {
      try {
        const account = await this.store.createAccount(data)
        const info = await this.store.addDeviceAccount(
          deviceId,
          account.sub,
          false,
        )

        await callAsync(this.hooks.onSignedUp, {
          data,
          info,
          account,
          deviceId,
          deviceMetadata,
        })

        return { account, info }
      } catch (err) {
        throw InvalidRequestError.from(
          err,
          'Unable to sign-up due to an unexpected server error',
        )
      }
    })
  }

  public async signIn(
    data: SignInData,
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
  ): Promise<AccountInfo> {
    return constantTime(TIMING_ATTACK_MITIGATION_DELAY, async () => {
      try {
        const account = await this.store.authenticateAccount(data)
        const info = await this.store.addDeviceAccount(
          deviceId,
          account.sub,
          data.remember,
        )

        await callAsync(this.hooks.onSignedIn, {
          data,
          info,
          account,
          deviceId,
          deviceMetadata,
        })

        return { account, info }
      } catch (err) {
        throw InvalidRequestError.from(
          err,
          'Unable to sign-in due to an unexpected server error',
        )
      }
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

  public async resetPasswordRequest(data: ResetPasswordRequestData) {
    return constantTime(TIMING_ATTACK_MITIGATION_DELAY, async () => {
      await this.store.resetPasswordRequest(data)
    })
  }

  public async resetPasswordConfirm(data: ResetPasswordConfirmData) {
    return constantTime(TIMING_ATTACK_MITIGATION_DELAY, async () => {
      await this.store.resetPasswordConfirm(data)
    })
  }

  public async verifyHandleAvailability(handle: string): Promise<void> {
    return constantTime(TIMING_ATTACK_MITIGATION_DELAY, async () => {
      return this.store.verifyHandleAvailability(handle)
    })
  }
}
