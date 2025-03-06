import {
  OAuthIssuerIdentifier,
  isOAuthClientIdLoopback,
} from '@atproto/oauth-types'
import { Client } from '../client/client.js'
import { DeviceId } from '../device/device-id.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { HCaptchaClient, HcaptchaVerifyResult } from '../lib/hcaptcha.js'
import { callAsync } from '../lib/util/function.js'
import { constantTime } from '../lib/util/time.js'
import { OAuthHooks, RequestMetadata } from '../oauth-hooks.js'
import { Customization } from '../oauth-provider.js'
import { Sub } from '../oidc/sub.js'
import { ClientAuth } from '../token/token-store.js'
import {
  Account,
  AccountInfo,
  AccountStore,
  ResetPasswordConfirmData,
  ResetPasswordRequestData,
} from './account-store.js'
import { SignInData } from './sign-in-data.js'
import { SignUpData } from './sign-up-data.js'

const TIMING_ATTACK_MITIGATION_DELAY = 400
const BRUTE_FORCE_MITIGATION_DELAY = 300

export class AccountManager {
  protected readonly inviteCodeRequired: boolean
  protected readonly hcaptchaClient?: HCaptchaClient

  constructor(
    issuer: OAuthIssuerIdentifier,
    protected readonly store: AccountStore,
    protected readonly hooks: OAuthHooks,
    customization: Customization,
  ) {
    this.inviteCodeRequired = customization.inviteCodeRequired !== false
    this.hcaptchaClient = customization.hcaptcha
      ? new HCaptchaClient(new URL(issuer).hostname, customization.hcaptcha)
      : undefined
  }

  protected async verifySignupData(
    data: SignUpData,
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
  ): Promise<void> {
    let hcaptchaResult: undefined | HcaptchaVerifyResult

    if (this.inviteCodeRequired && !data.inviteCode) {
      throw new InvalidRequestError('Invite code is required')
    }

    if (this.hcaptchaClient) {
      if (!data.hcaptchaToken) {
        throw new InvalidRequestError('hCaptcha token is required')
      }

      const { allowed, result } = await this.hcaptchaClient.verify(
        'signup',
        data.hcaptchaToken,
        deviceMetadata.ipAddress,
        data.handle,
        deviceMetadata.userAgent,
      )

      await callAsync(this.hooks.onSignupHcaptchaResult, {
        data,
        allowed,
        result,
        deviceId,
        deviceMetadata,
      })

      if (!allowed) {
        throw new InvalidRequestError('hCaptcha verification failed')
      }

      hcaptchaResult = result
    }

    await callAsync(this.hooks.onSignupAttempt, {
      data,
      deviceId,
      deviceMetadata,
      hcaptchaResult,
    })
  }

  public async signUp(
    data: SignUpData,
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
  ): Promise<AccountInfo> {
    await this.verifySignupData(data, deviceId, deviceMetadata)

    // Mitigation against brute forcing email of users.
    // @TODO Add rate limit to all the OAuth routes.
    return constantTime(BRUTE_FORCE_MITIGATION_DELAY, async () => {
      let account: Account
      try {
        account = await this.store.createAccount(data)
      } catch (err) {
        throw InvalidRequestError.from(err, 'Account creation failed')
      }

      try {
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
          'Something went wrong, try singing-in',
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
