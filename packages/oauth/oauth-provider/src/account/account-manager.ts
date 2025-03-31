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
    await callAsync(this.hooks.onSignupAttempt, {
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

    // When singing-up from a request flow, always mark the signup as
    // "temporary" (no "remember me").
    const remember = requestUri == null

    const requestId = requestUri ? decodeRequestUri(requestUri) : null
    const ephemeralCookie = remember ? null : await randomHexId(32)

    await this.store.addDeviceAccount(deviceId, account.sub, {
      authenticatedAt: new Date(),
      ephemeralCookie,
      requestId,
    })

    await callAsync(this.hooks.onSignedUp, {
      data,
      account,
      deviceId,
      deviceMetadata,
    }).catch((err) => {
      throw InvalidRequestError.from(
        err,
        'Something went wrong, try singing-in',
      )
    })

    return { account, ephemeralCookie }
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

    try {
      // If "remember" is true, do not bind the session to the request.
      const requestId =
        data.remember && requestUri ? decodeRequestUri(requestUri) : null

      const ephemeralCookie = data.remember ? null : await randomHexId(32)

      await this.store.addDeviceAccount(deviceId, account.sub, {
        authenticatedAt: new Date(),
        ephemeralCookie,
        requestId,
      })

      await callAsync(this.hooks.onSignedIn, {
        data,
        account,
        deviceId,
        deviceMetadata,
      })

      return { account, ephemeralCookie }
    } catch (err) {
      throw InvalidRequestError.from(
        err,
        'Something went wrong, try singing-in',
      )
    }
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

  public async getAuthorizedClients(sub: Sub) {
    return this.store.getAuthorizedClients(sub)
  }

  public async removeDeviceAccount(deviceId: DeviceId, sub: Sub) {
    return this.store.removeDeviceAccount(deviceId, sub)
  }

  public async list(deviceId: DeviceId): Promise<DeviceAccount[]> {
    const results = await this.store.listDeviceAccounts(deviceId)
    return results
      .filter((result) => result.deviceId === deviceId) // Fool proof
      .filter(({ data }) => !data.ephemeralCookie && !data.requestId)
  }

  public async listAccountDevices(sub: Sub): Promise<DeviceAccount[]> {
    const result = await this.store.listAccountDevices(sub)
    return result
      .filter((result) => result.account.sub === sub) // Fool proof
      .filter(({ data }) => !data.ephemeralCookie && !data.requestId)
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
