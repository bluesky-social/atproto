import {
  OAuthIssuerIdentifier,
  isOAuthClientIdLoopback,
} from '@atproto/oauth-types'
import { ClientId } from '../client/client-id.js'
import { Client } from '../client/client.js'
import { DeviceId } from '../device/device-id.js'
import { InvalidCredentialsError } from '../errors/invalid-credentials-error.js'
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
  ResetPasswordConfirmInput,
  ResetPasswordRequestInput,
  SignUpData,
  UpdateEmailConfirmInput,
  UpdateEmailRequestInput,
} from './account-store.js'
import { SignInData } from './sign-in-data.js'
import { SignUpInput } from './sign-up-input.js'

const TIMING_ATTACK_MITIGATION_DELAY = 400
const BRUTE_FORCE_MITIGATION_DELAY = 300

// @TODO Add rate limit to all the OAuth routes.

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

    await this.hooks.onHcaptchaResult?.call(null, {
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
    return constantTime(BRUTE_FORCE_MITIGATION_DELAY, async () => {
      await this.hooks.onSignUpAttempt?.call(null, {
        input,
        deviceId,
        deviceMetadata,
      })

      const data = await this.buildSignupData(input, deviceId, deviceMetadata)

      const account = await callAsync(() =>
        this.store.createAccount(data),
      ).catch((err) => {
        throw InvalidRequestError.from(err, 'Account creation failed')
      })

      try {
        await this.hooks.onSignedUp?.call(null, {
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
    })
  }

  public async authenticateAccount(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    data: SignInData,
    clientId?: ClientId,
  ): Promise<Account> {
    return constantTime(TIMING_ATTACK_MITIGATION_DELAY, async () => {
      await this.hooks.onSignInAttempt?.call(null, {
        data,
        deviceId,
        deviceMetadata,
        clientId,
      })

      const account = await callAsync(() =>
        this.store.authenticateAccount(data),
      ).catch(async (err) => {
        // Only notify for credential failures (e.g. unknown identifier, wrong
        // password). Server errors and flows that require an additional factor
        // (e.g. SecondAuthenticationFactorRequiredError) are not "failed
        // sign-ins" and do not trigger the hook.
        if (err instanceof InvalidRequestError) {
          // Stores that throw the more specific `InvalidCredentialsError`
          // can attach the matched subject identifier to distinguish
          // "identifier known, password wrong" from "identifier unknown".
          // This information is only exposed to the hook and is never
          // surfaced to the client.
          const isCredentialsError = err instanceof InvalidCredentialsError
          const sub = isCredentialsError ? err.sub ?? null : null

          // Swallow any error from the hook itself so that it does not mask
          // the underlying authentication failure being reported.
          try {
            await this.hooks.onSignInFailed?.call(null, {
              data,
              error: err,
              sub,
              deviceId,
              deviceMetadata,
              clientId,
            })
          } catch {
            // noop
          }

          if (isCredentialsError) {
            // Defensively downgrade to a plain InvalidRequestError
            throw new InvalidRequestError(err.error_description)
          }
        }

        throw err
      })

      await this.hooks.onSignedIn?.call(null, {
        data,
        account,
        deviceId,
        deviceMetadata,
        clientId,
      })

      return account
    }).catch((err) => {
      throw InvalidRequestError.from(
        err,
        'Unable to sign-in due to an unexpected server error',
      )
    })
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

  public async resetPasswordRequest(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    input: ResetPasswordRequestInput,
  ) {
    return constantTime(TIMING_ATTACK_MITIGATION_DELAY, async () => {
      await this.hooks.onResetPasswordRequest?.call(null, {
        input,
        deviceId,
        deviceMetadata,
      })

      const account = await this.store.resetPasswordRequest(input)

      // @NOTE Do not throw here, to prevent user enumeration

      await this.hooks.onResetPasswordRequested?.call(null, {
        input,
        deviceId,
        deviceMetadata,
        account,
      })
    })
  }

  public async resetPasswordConfirm(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    input: ResetPasswordConfirmInput,
  ) {
    return constantTime(TIMING_ATTACK_MITIGATION_DELAY, async () => {
      await this.hooks.onResetPasswordConfirm?.call(null, {
        input,
        deviceId,
        deviceMetadata,
      })

      const account = await this.store.resetPasswordConfirm(input)

      if (!account) {
        throw new InvalidRequestError('Invalid token')
      }

      await this.hooks.onResetPasswordConfirmed?.call(null, {
        input,
        deviceId,
        deviceMetadata,
        account,
      })

      return account
    })
  }

  public async verifyHandleAvailability(handle: string): Promise<void> {
    return constantTime(TIMING_ATTACK_MITIGATION_DELAY, async () => {
      return this.store.verifyHandleAvailability(handle)
    })
  }

  public async updateEmailRequest(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    input: UpdateEmailRequestInput,
    account: Account,
  ) {
    await this.hooks.onChangeEmailRequest?.call(null, {
      deviceId,
      deviceMetadata,
      input,
      account,
    })

    await this.store.updateEmailRequest(input)

    await this.hooks.onChangeEmailRequested?.call(null, {
      deviceId,
      deviceMetadata,
      input,
      account,
    })
  }

  public async updateEmailConfirm(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    input: UpdateEmailConfirmInput,
    account: Account,
  ): Promise<Account> {
    await this.hooks.onUpdateEmailConfirm?.call(null, {
      deviceId,
      deviceMetadata,
      input,
      account,
    })

    const updatedAccount = await this.store.updateEmailConfirm(input)

    if (!updatedAccount) {
      throw new InvalidRequestError('Invalid token')
    }

    await this.hooks.onUpdateEmailConfirmed?.call(null, {
      deviceId,
      deviceMetadata,
      input,
      account: updatedAccount,
    })

    return updatedAccount
  }
}
