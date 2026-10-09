import type { Did } from '@atproto/did'
import {
  type OAuthIssuerIdentifier,
  isOAuthClientIdLoopback,
} from '@atproto/oauth-types'
import type { ClientId } from '../client/client-id.js'
import type { Client } from '../client/client.js'
import type { DeviceId } from '../device/device-id.js'
import { InvalidCredentialsError } from '../errors/invalid-credentials-error.js'
import { InvalidRequestError } from '../errors/invalid-request-error.js'
import { HCaptchaClient, type HcaptchaVerifyResult } from '../lib/hcaptcha.js'
import { callAsync } from '../lib/util/function.js'
import { constantTime } from '../lib/util/time.js'
import type { OAuthHooks, RequestMetadata } from '../oauth-hooks.js'
import type { Customization } from '../oauth-provider.js'
import type {
  Account,
  AccountStore,
  AuthorizedClientData,
  DeleteAccountConfirmInput,
  DeleteAccountRequestInput,
  DeviceAccount,
  DisableEmailAuthFactorInput,
  EnableEmailAuthFactorInput,
  HandleString,
  ResetPasswordConfirmInput,
  ResetPasswordRequestInput,
  SignUpData,
  UpdateEmailConfirmInput,
  UpdateEmailRequestInput,
  UpdateHandleData,
  VerifyEmailConfirmInput,
  VerifyEmailRequestInput,
} from './account-store.js'
import type { SignInData } from './sign-in-data.js'
import type { SignUpInput } from './sign-up-input.js'

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

    const tokens = await this.hcaptchaClient.buildClientTokens(
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
    clientId?: ClientId,
  ): Promise<{ account: Account; remembered: boolean }> {
    return constantTime(BRUTE_FORCE_MITIGATION_DELAY, async () => {
      await callAsync(this.hooks.onSignUpAttempt, {
        input,
        deviceId,
        deviceMetadata,
        clientId,
      })

      const data = await this.buildSignupData(input, deviceId, deviceMetadata)

      const account = await callAsync(() =>
        this.store.createAccount(data),
      ).catch((err) => {
        throw InvalidRequestError.from(err, 'Account creation failed')
      })

      // @TODO Any error occurring below this point (server error most likely)
      // will not prevent the account from being created, but it will be
      // reported to the caller. We may want to wrap these errors in a way that
      // allows the UI to detect that a sing-up attempt will fail ("account
      // already exists"), and should provide appropriate feedback to the user
      // (eg. show sign-in form?).

      const isOAuthFlow = clientId != null
      const remembered = input.remember ?? !isOAuthFlow

      if (remembered) {
        await this.upsertDeviceAccount(deviceId, account.did)
      } else {
        // no need to remove the device account since it was never added (the
        // account was just created).
      }

      try {
        await callAsync(this.hooks.onSignedUp, {
          data,
          account,
          deviceId,
          deviceMetadata,
          clientId,
        })

        return { account, remembered }
      } catch (err) {
        // Delete the device account if an error occurred during the hook
        if (remembered) {
          await this.removeDeviceAccount(deviceId, account.did)
        }

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
  ): Promise<{ account: Account; remembered: boolean }> {
    return constantTime(TIMING_ATTACK_MITIGATION_DELAY, async () => {
      // @NOTE If the user did not explicitly specify a "remember" preference,
      // we will use the existence of previously remembered device accounts to
      // determine the default "remember" behavior.
      const deviceAccounts = await this.listDeviceAccounts(deviceId)

      await this.hooks.onSignInAttempt?.call(null, {
        data,
        deviceId,
        deviceMetadata,
        deviceAccounts,
        clientId,
      })

      const account = await callAsync(async () => {
        return this.store.authenticateAccount({
          locale: data.locale,
          password: data.password,
          username: data.username,
          emailOtp: data.emailOtp,
          deviceAccounts,
        })
      }).catch(async (error) => {
        // Only notify for credential failures (e.g. unknown identifier, wrong
        // password). Server errors and flows that require an additional factor
        // (SecondAuthenticationFactorRequiredError) are not "failed sign-ins"
        // and do not trigger the hook.

        // Stores that throw the more specific `InvalidCredentialsError`
        // can attach the matched subject identifier to distinguish
        // "identifier known, password wrong" from "identifier unknown".
        if (error instanceof InvalidRequestError) {
          await this.hooks.onSignInFailed?.call(null, {
            data,
            error,
            did: error instanceof InvalidCredentialsError ? error.did : null,
            deviceId,
            deviceMetadata,
            clientId,
          })
        }

        throw error
      })

      const remembered =
        // If the user has explicitly specified a "remember" preference, use it.
        data.remember ??
        // Fall back to checking if the account was previously remembered.
        deviceAccounts.some((da) => da.account.did === account.did)

      if (remembered) {
        await this.upsertDeviceAccount(deviceId, account.did)
      } else {
        // In case the user was already signed in, and signed in again, this
        // time without "remember me", let's sign them off of the device.
        await this.removeDeviceAccount(deviceId, account.did)
      }

      await this.hooks.onSignedIn?.call(null, {
        data,
        account,
        remembered,
        deviceId,
        deviceMetadata,
        clientId,
      })

      return { account, remembered }
    }).catch((err) => {
      throw InvalidRequestError.from(
        err,
        'Unable to sign-in due to an unexpected server error',
      )
    })
  }

  public async signOut(deviceId: DeviceId, did: Did) {
    await this.removeDeviceAccount(deviceId, did)
  }

  protected async upsertDeviceAccount(
    deviceId: DeviceId,
    did: Did,
  ): Promise<void> {
    await this.store.upsertDeviceAccount(deviceId, did)
  }

  protected async removeDeviceAccount(deviceId: DeviceId, did: Did) {
    return this.store.removeDeviceAccount(deviceId, did)
  }

  public async getDeviceAccount(
    deviceId: DeviceId,
    did: Did,
  ): Promise<DeviceAccount> {
    const deviceAccount = await this.store.getDeviceAccount(deviceId, did)
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

    await this.store.setAuthorizedClient(account.did, client.id, data)
  }

  public async getAccount(did: Did) {
    return this.store.getAccount(did)
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

  public async listAccountDevices(did: Did): Promise<DeviceAccount[]> {
    const deviceAccounts = await this.store.listDeviceAccounts({
      did,
    })

    return deviceAccounts // Fool proof
      .filter((deviceAccount) => deviceAccount.account.did === did)
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

  public async verifyHandleAvailability(handle: HandleString): Promise<void> {
    return constantTime(TIMING_ATTACK_MITIGATION_DELAY, async () => {
      return this.store.verifyHandleAvailability(handle)
    })
  }

  public async updateEmailRequest(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    input: UpdateEmailRequestInput,
    account: Account,
  ): Promise<{ tokenRequired: boolean }> {
    await this.hooks.onChangeEmailRequest?.call(null, {
      deviceId,
      deviceMetadata,
      input,
      account,
    })

    const { tokenRequired } = await this.store.updateEmailRequest(input)

    await this.hooks.onChangeEmailRequested?.call(null, {
      deviceId,
      deviceMetadata,
      input,
      account,
    })

    return { tokenRequired: tokenRequired === true }
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
      prevAccount: account,
    })

    return updatedAccount
  }

  public async verifyEmailRequest(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    input: VerifyEmailRequestInput,
    account: Account,
  ): Promise<void> {
    await this.hooks.onVerifyEmailRequest?.call(null, {
      deviceId,
      deviceMetadata,
      account,
      input,
    })

    await this.store.verifyEmailRequest(input)

    await this.hooks.onVerifyEmailRequested?.call(null, {
      deviceId,
      deviceMetadata,
      account,
      input,
    })
  }

  public async verifyEmailConfirm(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    input: VerifyEmailConfirmInput,
    account: Account,
  ): Promise<Account> {
    await this.hooks.onVerifyEmailConfirm?.call(null, {
      deviceId,
      deviceMetadata,
      account,
      input,
    })

    const updatedAccount = await this.store.verifyEmailConfirm(input)

    if (!updatedAccount) {
      throw new InvalidRequestError('Invalid token')
    }

    await this.hooks.onVerifyEmailConfirmed?.call(null, {
      deviceId,
      deviceMetadata,
      account: updatedAccount,
      input,
    })

    return updatedAccount
  }

  public async enableEmailAuthFactor(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    input: EnableEmailAuthFactorInput,
    account: Account,
  ): Promise<Account> {
    // Already enabled
    if (account.emailAuthFactor) return account

    await this.hooks.onEnableEmailAuthFactor?.call(null, {
      deviceId,
      deviceMetadata,
      input,
      account,
    })

    const updatedAccount = await this.store.enableEmailAuthFactor(input)

    if (updatedAccount.emailAuthFactor !== account.emailAuthFactor) {
      await this.hooks.onEnabledEmailAuthFactor?.call(null, {
        deviceId,
        deviceMetadata,
        input,
        account: updatedAccount,
      })
    }

    return updatedAccount
  }

  public async disableEmailAuthFactor(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    input: DisableEmailAuthFactorInput,
    account: Account,
  ): Promise<Account> {
    // Already disabled
    if (!account.emailAuthFactor) return account

    await this.hooks.onDisableEmailAuthFactor?.call(null, {
      deviceId,
      deviceMetadata,
      input,
      account,
    })

    const updatedAccount = await this.store.disableEmailAuthFactor(input)

    if (updatedAccount.emailAuthFactor !== account.emailAuthFactor) {
      await this.hooks.onDisabledEmailAuthFactor?.call(null, {
        deviceId,
        deviceMetadata,
        input,
        account: updatedAccount,
      })
    }

    return updatedAccount
  }

  public async updateHandle(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    input: UpdateHandleData,
    account: Account,
  ): Promise<Account> {
    await this.hooks.onUpdateHandle?.call(null, {
      deviceId,
      deviceMetadata,
      input,
      account,
    })

    const updatedAccount = await this.store.updateHandle(input)

    await this.hooks.onUpdatedHandle?.call(null, {
      deviceId,
      deviceMetadata,
      input,
      account: updatedAccount,
    })

    return updatedAccount
  }

  public async deactivateAccount(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    account: Account,
  ): Promise<Account> {
    await this.hooks.onDeactivateAccount?.call(null, {
      deviceId,
      deviceMetadata,
      account,
    })

    const updatedAccount = await callAsync(() =>
      this.store.deactivateAccount({
        did: account.did,
        // @TODO support setting this from the UI/API
        deleteAfter: undefined,
      }),
    ).catch((err) => {
      throw InvalidRequestError.from(err, 'Account deactivation failed')
    })

    await this.hooks.onDeactivatedAccount?.call(null, {
      deviceId,
      deviceMetadata,
      account: updatedAccount,
    })

    return updatedAccount
  }

  public async reactivateAccount(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    account: Account,
  ): Promise<Account> {
    await this.hooks.onReactivateAccount?.call(null, {
      deviceId,
      deviceMetadata,
      account,
    })

    const updatedAccount = await callAsync(() =>
      this.store.reactivateAccount({ did: account.did }),
    ).catch((err) => {
      throw InvalidRequestError.from(err, 'Account reactivation failed')
    })

    await this.hooks.onReactivatedAccount?.call(null, {
      deviceId,
      deviceMetadata,
      account: updatedAccount,
    })

    return updatedAccount
  }

  public async deleteAccountRequest(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    input: DeleteAccountRequestInput,
    account: Account,
  ): Promise<void> {
    await this.hooks.onDeleteAccountRequest?.call(null, {
      deviceId,
      deviceMetadata,
      account,
    })

    await this.store.deleteAccountRequest(input)

    await this.hooks.onDeleteAccountRequested?.call(null, {
      deviceId,
      deviceMetadata,
      account,
    })
  }

  public async deleteAccountConfirm(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    input: DeleteAccountConfirmInput,
    account: Account,
  ): Promise<void> {
    return constantTime(BRUTE_FORCE_MITIGATION_DELAY, async () => {
      await this.hooks.onDeleteAccountConfirm?.call(null, {
        deviceId,
        deviceMetadata,
        account,
      })

      await callAsync(() => this.store.deleteAccountConfirm(input)).catch(
        (err) => {
          throw InvalidRequestError.from(err, 'Account deletion failed')
        },
      )

      await this.hooks.onDeleteAccountConfirmed?.call(null, {
        deviceId,
        deviceMetadata,
        account,
        input,
      })
    })
  }
}
