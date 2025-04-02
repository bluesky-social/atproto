import {
  OAuthIssuerIdentifier,
  isOAuthClientIdLoopback,
} from '@atproto/oauth-types'
import { Client } from '../client/client.js'
import { DeviceId } from '../device/device-id.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { HCaptchaClient, HcaptchaVerifyResult } from '../lib/hcaptcha.js'
import { randomHexId } from '../lib/util/crypto.js'
import { callAsync } from '../lib/util/function.js'
import { constantTime } from '../lib/util/time.js'
import { OAuthHooks, RequestMetadata } from '../oauth-hooks.js'
import { Customization } from '../oauth-provider.js'
import { Sub } from '../oidc/sub.js'
import { RequestId } from '../request/request-id.js'
import { RequestUri, decodeRequestUri } from '../request/request-uri.js'
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

    const { allowed, result } = await this.hcaptchaClient
      .verify(
        'signup',
        input.hcaptchaToken,
        deviceMetadata.ipAddress,
        input.handle,
        deviceMetadata.userAgent,
      )
      .catch((err) => {
        throw InvalidRequestError.from(err, 'hCaptcha verification failed')
      })

    if (!allowed) {
      throw new InvalidRequestError('hCaptcha verification failed')
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
    requestUri?: RequestUri,
  ): Promise<{ account: Account; ephemeralCookie: string | null }> {
    const requestId = requestUri ? decodeRequestUri(requestUri) : null

    await callAsync(this.hooks.onSignUpAttempt, {
      input,
      deviceId,
      deviceMetadata,
      requestId,
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

    // Only "remember" the newly created account if it was not created during an
    // OAuth flow.
    const remembered = requestId == null

    const ephemeralCookie = remembered ? null : await randomHexId(32)

    await this.addDeviceAccount(
      deviceId,
      account,
      remembered,
      requestId,
      ephemeralCookie,
    )

    try {
      await callAsync(this.hooks.onSignedUp, {
        data,
        account,
        deviceId,
        deviceMetadata,
        requestId,
      })

      return { account, ephemeralCookie }
    } catch (err) {
      await this.removeDeviceAccounts(deviceId, account.sub)

      throw InvalidRequestError.from(
        err,
        'The account was successfully created but something went wrong, try singing-in.',
      )
    }
  }

  public async authenticateAccount(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    data: SignInData,
    requestUri?: RequestUri,
  ): Promise<{
    account: Account
    ephemeralCookie: string | null
  }> {
    const requestId = requestUri ? decodeRequestUri(requestUri) : null

    await callAsync(this.hooks.onSignInAttempt, {
      data,
      deviceId,
      deviceMetadata,
      requestId,
    })

    const account = await constantTime(
      TIMING_ATTACK_MITIGATION_DELAY,
      async () => {
        return this.store.authenticateAccount(data)
      },
    ).catch((err) => {
      throw InvalidRequestError.from(
        err,
        'Unable to sign-in due to an unexpected server error',
      )
    })

    const remembered = data.remember === true

    const ephemeralCookie = remembered ? null : await randomHexId(32)

    await this.addDeviceAccount(
      deviceId,
      account,
      remembered,
      requestId,
      ephemeralCookie,
    )

    try {
      await callAsync(this.hooks.onSignedIn, {
        data,
        account,
        deviceId,
        deviceMetadata,
        requestId,
      })

      return { account, ephemeralCookie }
    } catch (err) {
      await this.removeDeviceAccounts(deviceId, account.sub)

      throw err
    }
  }

  protected async addDeviceAccount(
    deviceId: DeviceId,
    account: Account,
    remembered: boolean,
    requestId: RequestId | null,
    ephemeralCookie: string | null,
  ): Promise<void> {
    await this.store.addDeviceAccount(deviceId, account.sub, {
      authenticatedAt: new Date(),
      remembered,
      // If "remember" is true, do not bind the session to the request.
      requestId: remembered ? null : requestId,
      ephemeralCookie,
    })
  }

  public async getDeviceAccount(
    deviceId: DeviceId,
    sub: Sub,
    requestUri?: RequestUri,
  ): Promise<DeviceAccount> {
    const requestId = requestUri ? decodeRequestUri(requestUri) : null

    const deviceAccount = await this.store.getDeviceAccount(
      deviceId,
      sub,
      requestId,
    )
    if (!deviceAccount) throw new InvalidRequestError(`Account not found`)

    // Fool-proofing
    if (!requestId && deviceAccount.data.requestId) {
      throw new Error('DeviceAccount was bound to a request')
    }
    if (
      requestId &&
      deviceAccount.data.requestId &&
      deviceAccount.data.requestId !== requestId
    ) {
      throw new Error('DeviceAccount was bound to another request')
    }

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

  public async removeRequestAccounts(requestUri: RequestUri) {
    const requestId = decodeRequestUri(requestUri)
    return this.store.removeRequestAccounts(requestId)
  }

  public async removeDeviceAccounts(deviceId: DeviceId, sub: Sub) {
    return this.store.removeDeviceAccounts(deviceId, sub)
  }

  public async listDeviceAccounts(
    deviceId: DeviceId,
    requestUri: RequestUri | null = null,
    ephemeralCookies: string[] = [],
  ): Promise<DeviceAccount[]> {
    const requestId = requestUri ? decodeRequestUri(requestUri) : null
    const deviceAccounts = await this.store.listDeviceAccounts(deviceId)
    return deviceAccounts
      .filter((deviceAccount) => deviceAccount.deviceId === deviceId) // Fool proof
      .filter(
        ({ data }) =>
          (data.requestId === null || data.requestId === requestId) &&
          (data.ephemeralCookie == null ||
            ephemeralCookies.includes(data.ephemeralCookie)),
      )
  }

  public async listAccountDevices(
    sub: Sub,
    requestUri: RequestUri | null = null,
    ephemeralCookies: string[] = [],
  ): Promise<DeviceAccount[]> {
    const requestId = requestUri ? decodeRequestUri(requestUri) : null
    const deviceAccounts = await this.store.listAccountDevices(sub)
    return deviceAccounts
      .filter((deviceAccount) => deviceAccount.account.sub === sub) // Fool proof
      .filter(
        ({ data }) =>
          (data.requestId === null || data.requestId === requestId) &&
          (data.ephemeralCookie == null ||
            ephemeralCookies.includes(data.ephemeralCookie)),
      )
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
