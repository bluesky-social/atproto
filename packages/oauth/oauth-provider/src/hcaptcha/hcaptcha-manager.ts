import type { OAuthIssuerIdentifier } from '@atproto/oauth-types'
import type { DeviceId } from '../device/device-id.js'
import { CaptchaRejectedError } from '../errors/captcha-rejected-error.js'
import { CaptchaRequiredError } from '../errors/captcha-required-error.js'
import {
  HCaptchaClient,
  type HcaptchaConfig,
  type HcaptchaVerifyResult,
} from '../lib/hcaptcha.js'
import type { RequestMetadata } from '../lib/http/request.js'
import { normalizeIdentifierString } from '../lib/identifier.js'
import type { OAuthHooks } from '../oauth-hooks.js'
import type { HcaptchaClientTokens } from './hcaptcha-client-tokens.js'
import type { HcaptchaVerifyData } from './hcaptcha-verify-data.js'

export type { HcaptchaClientTokens, HcaptchaVerifyData }

export class HCaptchaManager {
  protected readonly client?: HCaptchaClient

  constructor(
    issuer: OAuthIssuerIdentifier,
    protected readonly hooks: OAuthHooks,
    config?: HcaptchaConfig,
  ) {
    this.client = config
      ? new HCaptchaClient(new URL(issuer).hostname, config)
      : undefined
  }

  get enabled(): boolean {
    return this.client != null
  }

  /**
   * @returns `undefined` when hCaptcha is not configured
   * @throws {CaptchaRequiredError} when no token was provided
   * @throws {CaptchaRejectedError} when the token could not be verified,
   * including when hCaptcha could not be reached
   */
  public async verify(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    data: HcaptchaVerifyData,
  ): Promise<HcaptchaVerifyResult | undefined> {
    const { client } = this
    if (!client) return undefined

    if (!data.input.hcaptchaToken) {
      throw new CaptchaRequiredError()
    }

    const tokens = await this.buildClientTokens(deviceId, deviceMetadata, data)

    try {
      const result = await client.verify(
        data.input.hcaptchaToken,
        deviceMetadata.ipAddress,
        data.action === 'sign-up'
          ? 'signup'
          : data.action === 'sign-in'
            ? 'login'
            : undefined, // no equivalent behavior type for other actions
        tokens,
      )

      await this.hooks.onHcaptchaResult?.call(null, {
        ...data,
        deviceId,
        deviceMetadata,
        tokens,
        result,
      })

      client.checkVerifyResult(result, tokens)

      return result
    } catch (err) {
      throw CaptchaRejectedError.from(err)
    }
  }

  protected async buildClientTokens(
    deviceId: DeviceId,
    deviceMetadata: RequestMetadata,
    data: HcaptchaVerifyData,
  ): Promise<HcaptchaClientTokens> {
    const { client } = this
    if (!client) throw new Error('HCaptcha client not configured')

    const inputEmail =
      'email' in data.input
        ? normalizeIdentifierString(data.input.email)
        : undefined
    const inputIdentifier =
      data.action === 'sign-up'
        ? normalizeIdentifierString(data.input.handle)
        : 'identifier' in data.input
          ? normalizeIdentifierString(data.input.identifier)
          : undefined
    const identifierEmail = inputIdentifier?.includes('@', 1)
      ? inputIdentifier
      : undefined

    const email = inputEmail || identifierEmail
    const identifier = inputIdentifier === email ? undefined : inputIdentifier

    // @NOTE We are **not** using Promise.all here because libuv's thread pool
    // might get saturated, leading to performance degradation. Instead, we
    // await each hash sequentially, ensuring that every HTTP request only uses
    // one thread at a time.
    return {
      hashedIp: await client.hashToken(deviceMetadata.ipAddress),
      hashedEmail: email ? await client.hashToken(email) : undefined,
      hashedIdentifier: identifier
        ? await client.hashToken(identifier)
        : undefined,
      hashedUserAgent: deviceMetadata.userAgent
        ? await client.hashToken(deviceMetadata.userAgent)
        : undefined,
    }
  }
}
