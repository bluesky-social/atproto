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
import {
  Account,
  AccountStore,
  AuthorizedClientData,
  DeviceAccount,
  ResetPasswordConfirmData,
  ResetPasswordRequestData,
  SignUpData,
} from './account-store.js'
import { SignInData } from './sign-in-data.js'
import { SignUpInput } from './sign-up-input.js'

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

  protected async processHcaptchaToken(
    input: SignUpInput,
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
  ): Promise<HcaptchaVerifyResult | undefined> {
    if (!this.hcaptchaClient) {
      return undefined
    }

    if (!input.hcaptchaToken) {
      throw new InvalidRequestError('hCaptcha token is required')
    }

    const tokens = this.hcaptchaClient.buildClientTokens(
      deviceMetadata.ipAddress,
      input.handle,
      deviceMetadata.userAgent,
    )

    const result = await this.hcaptchaClient
      .verify('signup', input.hcaptchaToken, deviceMetadata.ipAddress, tokens)
      .catch((err) => {
        throw InvalidRequestError.from(err, 'hCaptcha verification failed')
      })

    await callAsync(this.hooks.onHcaptchaResult, {
      input,
      deviceId,
      deviceMetadata,
      tokens,
      result,
    })

    try {
      this.hcaptchaClient.checkVerifyResult(result, tokens)
    } catch (err) {
      throw InvalidRequestError.from(err, 'hCaptcha verification failed')
    }

    return result
  }

  protected async enforceInviteCode(
    input: SignUpInput,
    _deviceId: DeviceId,
    _deviceMetadata: RequestMetadata,
  ): Promise<string | undefined> {
    if (!this.inviteCodeRequired) {
      return undefined
    }

    if (!input.inviteCode) {
      throw new InvalidRequestError('Invite code is required')
    }

    return input.inviteCode
  }

  protected async buildSignupData(
    input: SignUpInput,
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
  ): Promise<SignUpData> {
    const [hcaptchaResult, inviteCode] = await Promise.all([
      this.processHcaptchaToken(input, deviceId, deviceMetadata),
      this.enforceInviteCode(input, deviceId, deviceMetadata),
    ])

    return { ...input, hcaptchaResult, inviteCode }
  }

  public async createAccount(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    input: SignUpInput,
  ): Promise<Account> {
    await callAsync(this.hooks.onSignUpAttempt, {
      input,
      deviceId,
      deviceMetadata,
    })

    const data = await this.buildSignupData(input, deviceId, deviceMetadata)

    // Mitigation against brute forcing email of users.
    // @TODO Add rate limit to all the OAuth routes.
    const account = await constantTime(
      BRUTE_FORCE_MITIGATION_DELAY,
      async () => {
        return this.store.createAccount(data)
      },
    ).catch((err) => {
      throw InvalidRequestError.from(err, 'Account creation failed')
    })

    try {
      await callAsync(this.hooks.onSignedUp, {
        data,
        account,
        deviceId,
        deviceMetadata,
      })

      return account
    } catch (err) {
      await this.removeDeviceAccount(deviceId, account.sub)

      throw InvalidRequestError.from(
        err,
        'The account was successfully created but something went wrong, try signing-in.',
      )
    }
  }

  public async authenticateAccount(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    data: SignInData,
  ): Promise<Account> {
    try {
      await callAsync(this.hooks.onSignInAttempt, {
        data,
        deviceId,
        deviceMetadata,
      })

      const account = await constantTime(
        TIMING_ATTACK_MITIGATION_DELAY,
        async () => {
          return this.store.authenticateAccount(data)
        },
      )

      await callAsync(this.hooks.onSignedIn, {
        data,
        account,
        deviceId,
        deviceMetadata,
      })

      return account
    } catch (err) {
      throw InvalidRequestError.from(
        err,
        'Unable to sign-in due to an unexpected server error',
      )
    }
  }

  public async upsertDeviceAccount(
    deviceId: DeviceId,
    sub: Sub,
  ): Promise<void> {
    await this.store.upsertDeviceAccount(deviceId, sub)
  }

  public async getDeviceAccount(
    deviceId: DeviceId,
    sub: Sub,
  ): Promise<DeviceAccount> {
    const deviceAccount = await this.store.getDeviceAccount(deviceId, sub)
    if (!deviceAccount) throw new InvalidRequestError(`Account not found`)

    return deviceAccount
  }

  public async setAuthorizedClient(
    account: Account,
    client: Client,
    data: AuthorizedClientData,
  ): Promise<void> {
    // "Loopback" clients are not distinguishable from one another.
    if (isOAuthClientIdLoopback(client.id)) return

    await this.store.setAuthorizedClient(account.sub, client.id, data)
  }

  public async getAccount(sub: Sub) {
    return this.store.getAccount(sub)
  }

  public async removeDeviceAccount(deviceId: DeviceId, sub: Sub) {
    return this.store.removeDeviceAccount(deviceId, sub)
  }

  public async listDeviceAccounts(
    deviceId: DeviceId,
  ): Promise<DeviceAccount[]> {
    const deviceAccounts = await this.store.listDeviceAccounts({
      deviceId,
    })

    return deviceAccounts // Fool proof
      .filter((deviceAccount) => deviceAccount.deviceId === deviceId)
  }

  public async listAccountDevices(sub: Sub): Promise<DeviceAccount[]> {
    const deviceAccounts = await this.store.listDeviceAccounts({
      sub,
    })

    return deviceAccounts // Fool proof
      .filter((deviceAccount) => deviceAccount.account.sub === sub)
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
