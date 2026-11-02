import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type {
  AccountSessionsInput,
  ApiEndpoints,
  ConfirmAccountDeletionInput,
  ConfirmEmailUpdateInput,
  ConfirmEmailVerificationInput,
  ConfirmResetPasswordInput,
  DeactivateAccountInput,
  DidString,
  DisableEmailAuthFactorInput,
  EnableEmailAuthFactorInput,
  HandleUnavailableReason,
  InitiateAccountDeletionInput,
  InitiateEmailUpdateInput,
  InitiateEmailVerificationInput,
  InitiatePasswordResetInput,
  OAuthSessionsInput,
  ReactivateAccountInput,
  RevokeAccountSessionInput,
  RevokeOAuthSessionInput,
  SignInInput,
  SignOutInput,
  SignUpInput,
  UpdateHandleInput,
  VerifyHandleAvailabilityInput,
} from '@atproto/oauth-provider-api'
import {
  API_ENDPOINT_PREFIX,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  isHandleUnavailableReason,
} from '@atproto/oauth-provider-api'
import { readCookie } from './cookies.ts'
import {
  type Json,
  JsonClient,
  type JsonClientOptions,
  JsonErrorResponse,
  type Options,
} from './json-client.ts'

export type { Options } from './json-client.ts'

export type ApiOptions = JsonClientOptions<ApiEndpoints> & {
  locale: string
}

export type WithOptionalLocale<T> = T extends { locale?: unknown }
  ? Omit<T, 'locale'> & { locale?: T['locale'] }
  : T

export class Api extends JsonClient<ApiEndpoints> {
  locale: string

  constructor(options: ApiOptions) {
    const baseUrl = new URL(API_ENDPOINT_PREFIX, window.origin).toString()
    super(baseUrl, {
      ...options,
      headers: async function () {
        const headers = new Headers(await options?.headers?.call(this))
        const csrfToken = readCookie(CSRF_COOKIE_NAME)
        if (csrfToken) headers.set(CSRF_HEADER_NAME, csrfToken)
        return headers
      },
    })
    this.locale = options.locale
  }

  async signIn(
    {
      identifier,
      password,
      locale = this.locale,
      emailOtp = undefined,
      remember = undefined, // Default applied by backend based on context
      hcaptchaToken = undefined,
    }: WithOptionalLocale<SignInInput>,
    options?: Options,
  ) {
    return this.fetch(
      'POST',
      '/sign-in',
      { identifier, password, locale, emailOtp, remember, hcaptchaToken },
      options,
    )
  }

  async initiatePasswordReset(
    {
      identifier,
      locale = this.locale,
      hcaptchaToken = undefined,
    }: WithOptionalLocale<InitiatePasswordResetInput>,
    options?: Options,
  ) {
    await this.fetch(
      'POST',
      '/reset-password-request',
      { identifier, locale, hcaptchaToken },
      options,
    )
  }

  // Account sessions

  async accountSessions({ did }: AccountSessionsInput, options?: Options) {
    return this.fetch('GET', '/account-sessions', { did }, options)
  }

  async revokeAccountSession(
    { did, deviceId }: RevokeAccountSessionInput,
    options?: Options,
  ) {
    return this.fetch(
      'POST',
      '/revoke-account-session',
      { did, deviceId },
      options,
    )
  }

  // OAuth sessions

  async oauthSessions({ did }: OAuthSessionsInput, options?: Options) {
    return this.fetch('GET', '/oauth-sessions', { did }, options)
  }

  async revokeOAuthSession(
    { did, tokenId }: RevokeOAuthSessionInput,
    options?: Options,
  ) {
    return this.fetch(
      'POST',
      '/revoke-oauth-session',
      { did, tokenId },
      options,
    )
  }

  //

  async confirmResetPassword(
    { token, password, hcaptchaToken = undefined }: ConfirmResetPasswordInput,
    options?: Options,
  ) {
    await this.fetch(
      'POST',
      '/reset-password-confirm',
      { token, password, hcaptchaToken },
      options,
    )
  }

  async validateHandleAvailability(
    { handle }: VerifyHandleAvailabilityInput,
    options?: Options,
  ) {
    await this.fetch('POST', '/verify-handle-availability', { handle }, options)
  }

  async updateEmailRequest(
    { did, locale = this.locale }: WithOptionalLocale<InitiateEmailUpdateInput>,
    options?: Options,
  ) {
    return this.fetch('POST', '/update-email-request', { did, locale }, options)
  }

  async updateEmailConfirm(
    {
      did,
      token,
      email,
      locale = this.locale,
    }: WithOptionalLocale<ConfirmEmailUpdateInput>,
    options?: Options,
  ) {
    await this.fetch(
      'POST',
      '/update-email-confirm',
      { did, token, email, locale },
      options,
    )
  }

  async verifyEmailRequest(
    {
      did,
      locale = this.locale,
    }: WithOptionalLocale<InitiateEmailVerificationInput>,
    options?: Options,
  ) {
    await this.fetch('POST', '/verify-email-request', { did, locale }, options)
  }

  async verifyEmailConfirm(
    { did, token, email }: ConfirmEmailVerificationInput,
    options?: Options,
  ) {
    await this.fetch(
      'POST',
      '/verify-email-confirm',
      { did, token, email },
      options,
    )
  }

  async enableEmailAuthFactor(
    {
      did,
      locale = this.locale,
    }: WithOptionalLocale<EnableEmailAuthFactorInput>,
    options?: Options,
  ) {
    return this.fetch('POST', '/enable-email-otp', { did, locale }, options)
  }

  async disableEmailAuthFactor(
    {
      did,
      token,
      locale = this.locale,
    }: WithOptionalLocale<DisableEmailAuthFactorInput>,
    options?: Options,
  ) {
    return this.fetch(
      'POST',
      '/disable-email-otp',
      { did, token, locale },
      options,
    )
  }

  async updateHandle({ did, handle }: UpdateHandleInput, options?: Options) {
    return this.fetch('POST', '/update-handle', { did, handle }, options)
  }

  async deactivateAccount({ did }: DeactivateAccountInput, options?: Options) {
    await this.fetch('POST', '/deactivate-account', { did }, options)
  }

  async reactivateAccount({ did }: ReactivateAccountInput, options?: Options) {
    return this.fetch('POST', '/reactivate-account', { did }, options)
  }

  async deleteAccountRequest(
    {
      did,
      locale = this.locale,
    }: WithOptionalLocale<InitiateAccountDeletionInput>,
    options?: Options,
  ) {
    await this.fetch(
      'POST',
      '/delete-account-request',
      { did, locale },
      options,
    )
  }

  async deleteAccountConfirm(
    { did, token, password }: ConfirmAccountDeletionInput,
    options?: Options,
  ) {
    await this.fetch(
      'POST',
      '/delete-account-confirm',
      { did, token, password },
      options,
    )
  }

  async signUp(
    {
      locale = this.locale,
      handle,
      email,
      password,
      remember,
      inviteCode,
      hcaptchaToken,
    }: WithOptionalLocale<SignUpInput>,
    options?: Options,
  ) {
    return this.fetch(
      'POST',
      '/sign-up',
      { locale, handle, email, password, remember, inviteCode, hcaptchaToken },
      options,
    )
  }

  async signOut({ did }: SignOutInput, options?: Options) {
    return this.fetch('POST', '/sign-out', { did }, options)
  }

  async consent(did: DidString, scope?: string, options?: Options) {
    return this.fetch('POST', '/consent', { did, scope }, options)
  }

  async reject(options?: Options) {
    return this.fetch('POST', '/reject', {}, options)
  }

  // and transform them into instances of the corresponding error classes.
  protected override parseError(response: Response, payload: Json): Error {
    return (
      parseApiErrorPayload(response.status, response.headers, payload) ??
      super.parseError(response, payload)
    )
  }
}

export function parseApiErrorPayload(
  status: number,
  headers: Headers,
  payload: Json,
): OAuthErrorResponse | undefined {
  for (const ErrorClass of [
    // @NOTE Most specific errors must come first!
    RateLimitExceededError,
    UnknownRequestUriError,
    UnknownAtprotoAccountError,
    SecondAuthenticationFactorRequiredError,
    CaptchaRequiredError,
    CaptchaRejectedError,
    InvalidCredentialsError,
    InvalidInviteCodeError,
    HandleUnavailableError,
    EmailTakenError,
    RequestExpiredError,
    UnauthorizedError,
    InvalidRequestError,
    AccessDeniedError,
    OAuthErrorResponse,
  ] as Array<{
    is(status: number, headers: Headers, payload: Json): boolean
    new (status: number, headers: Headers, payload: any): OAuthErrorResponse
  }>) {
    if (ErrorClass.is(status, headers, payload)) {
      return new ErrorClass(status, headers, payload)
    }
  }
}

export type OAuthErrorPayload<E extends string = string> = {
  error: E
  error_description?: string
} & Record<string, Json>

export function isOAuthErrorPayload<E extends string = string>(
  json: Json,
  error: E,
): json is OAuthErrorPayload<E>
export function isOAuthErrorPayload(json: Json): json is OAuthErrorPayload
export function isOAuthErrorPayload(json: Json, error?: string): boolean {
  return (
    json != null &&
    typeof json === 'object' &&
    'error' in json &&
    typeof json['error'] === 'string' &&
    (error === undefined || json['error'] === error) &&
    (json['error_description'] === undefined ||
      typeof json['error_description'] === 'string')
  )
}

export class OAuthErrorResponse<
  P extends OAuthErrorPayload = OAuthErrorPayload,
> extends JsonErrorResponse<P> {
  name = 'OAuthErrorResponse'

  constructor(
    status: number,
    headers: Headers,
    payload: P,
    message = payload.error_description,
    options?: ErrorOptions,
  ) {
    super(
      status,
      headers,
      payload,
      message || `OAuth Error "${payload.error}"`,
      options,
    )
    this.msg = OAuthErrorResponse.getMessageForError(payload.error)
  }

  static is(
    _status: number,
    _headers: Headers,
    payload: Json,
  ): payload is OAuthErrorPayload {
    return isOAuthErrorPayload(payload)
  }

  protected static getMessageForError(error: string): MessageDescriptor {
    switch (error) {
      // @NOTE This only needs value that are not already covered by more
      // specific error classes with their own messages (e.g.
      // InvalidCredentialsError). The base OAuthErrorResponse message is a
      // generic fallback for any unrecognized error codes.
      case 'server_error':
        return msg`The server encountered an unexpected error. Please try again.`
      default:
        return msg`An unexpected error occurred.`
    }
  }
}

export type UnauthorizedPayload = OAuthErrorPayload<'unauthorized'>
export class UnauthorizedError<
  P extends UnauthorizedPayload = UnauthorizedPayload,
> extends OAuthErrorResponse<P> {
  override msg = msg`This sign-in session has expired`

  constructor(status: number, headers: Headers, payload: P) {
    super(status, headers, payload, payload.error_description || 'Unauthorized')
  }

  static is(
    status: number,
    headers: Headers,
    payload: Json,
  ): payload is UnauthorizedPayload {
    return (
      super.is(status, headers, payload) && payload.error === 'unauthorized'
    )
  }
}

export type AccessDeniedPayload = OAuthErrorPayload<'access_denied'>
export class AccessDeniedError<
  P extends AccessDeniedPayload = AccessDeniedPayload,
> extends OAuthErrorResponse<P> {
  override msg = msg`This authorization request has been denied. Please try again.`

  constructor(
    status: number,
    headers: Headers,
    payload: P,
    message = payload.error_description,
  ) {
    super(status, headers, payload, message || 'Access denied')
  }

  static is(
    status: number,
    headers: Headers,
    payload: Json,
  ): payload is AccessDeniedPayload {
    return (
      super.is(status, headers, payload) && payload.error === 'access_denied'
    )
  }
}

export type InvalidRequestPayload = OAuthErrorPayload<'invalid_request'>
export class InvalidRequestError<
  P extends InvalidRequestPayload = InvalidRequestPayload,
> extends OAuthErrorResponse<P> {
  override msg = msg`The data you submitted is invalid. Please check the form and try again.`

  constructor(
    status: number,
    headers: Headers,
    payload: P,
    message = payload.error_description,
  ) {
    super(status, headers, payload, message || 'Invalid request')
  }

  static is(
    status: number,
    headers: Headers,
    payload: Json,
  ): payload is InvalidRequestPayload {
    return (
      super.is(status, headers, payload) && payload.error === 'invalid_request'
    )
  }
}

export type HandleUnavailablePayload =
  OAuthErrorPayload<'handle_unavailable'> & {
    reason: HandleUnavailableReason
  }
export class HandleUnavailableError<
  P extends HandleUnavailablePayload = HandleUnavailablePayload,
> extends OAuthErrorResponse<P> {
  constructor(
    status: number,
    headers: Headers,
    payload: P,
    message = payload.error_description,
  ) {
    super(status, headers, payload, message || 'Handle unavailable')
    this.msg = HandleUnavailableError.getMessageForReason(payload.reason)
  }

  static getMessageForReason(
    reason: HandleUnavailableReason,
  ): MessageDescriptor {
    switch (reason) {
      case 'syntax':
        return msg`The username is invalid`
      case 'domain':
        return msg`The domain name is not allowed`
      case 'slur':
        return msg`The username contains inappropriate language`
      case 'reserved':
        return msg`This username is reserved`
      case 'taken':
        return msg`The username is already in use`
      case 'resolution':
        return msg`The username could not be resolved`
      case 'unsupported':
        // @NOTE Only happens during account creation: should never happen since
        // the UI doesn't allow entering custom handles during account creation.
        return msg`Custom domains are not supported`
    }
  }

  static is(
    status: number,
    headers: Headers,
    payload: Json,
  ): payload is HandleUnavailablePayload {
    return (
      super.is(status, headers, payload) &&
      payload.error === 'handle_unavailable' &&
      isHandleUnavailableReason(payload['reason'])
    )
  }
}

export const SECOND_AUTH_FACTOR_TYPES = Object.freeze(['emailOtp'] as const)
export type SecondAuthFactorType = (typeof SECOND_AUTH_FACTOR_TYPES)[number]
export const isSecondAuthFactorType = (
  value: unknown,
): value is SecondAuthFactorType =>
  (SECOND_AUTH_FACTOR_TYPES as readonly unknown[]).includes(value)

export type SecondAuthenticationFactorRequiredPayload =
  OAuthErrorPayload<'second_authentication_factor_required'> & {
    type: SecondAuthFactorType
    hint: string
  }
export class SecondAuthenticationFactorRequiredError<
  P extends SecondAuthenticationFactorRequiredPayload =
    SecondAuthenticationFactorRequiredPayload,
> extends OAuthErrorResponse<P> {
  constructor(
    status: number,
    headers: Headers,
    payload: P,
    message = payload.error_description,
  ) {
    const { type, hint } = payload
    super(
      status,
      headers,
      payload,
      message || `${type} auth factor required (hint: ${hint})`,
    )
    this.msg = msg`A second authentication factor is required (${hint})`
  }

  get type() {
    return this.payload.type
  }
  get hint() {
    return this.payload.hint
  }

  static is(
    status: number,
    headers: Headers,
    payload: Json,
  ): payload is SecondAuthenticationFactorRequiredPayload {
    return (
      super.is(status, headers, payload) &&
      payload.error === 'second_authentication_factor_required' &&
      isSecondAuthFactorType(payload['type']) &&
      typeof payload['hint'] === 'string'
    )
  }
}

export type CaptchaRequiredPayload = OAuthErrorPayload<'captcha_required'>
export class CaptchaRequiredError<
  P extends CaptchaRequiredPayload = CaptchaRequiredPayload,
> extends OAuthErrorResponse<P> {
  override name = 'CaptchaRequiredError'
  // @NOTE Only displayed when the UI is unable to show a captcha challenge
  override msg = msg`Unable to verify that you are human. Please try again later.`

  constructor(
    status: number,
    headers: Headers,
    payload: P,
    message = payload.error_description || 'Captcha required',
  ) {
    super(status, headers, payload, message)
  }

  static is(
    status: number,
    headers: Headers,
    payload: Json,
  ): payload is CaptchaRequiredPayload {
    return (
      super.is(status, headers, payload) && payload.error === 'captcha_required'
    )
  }
}

export type CaptchaRejectedPayload = OAuthErrorPayload<'captcha_rejected'>
export class CaptchaRejectedError<
  P extends CaptchaRejectedPayload = CaptchaRejectedPayload,
> extends OAuthErrorResponse<P> {
  override name = 'CaptchaRejectedError'
  override msg = msg`Unable to verify that you are human. Please try again later.`

  constructor(
    status: number,
    headers: Headers,
    payload: P,
    message = payload.error_description || 'Captcha rejected',
  ) {
    super(status, headers, payload, message)
  }

  static is(
    status: number,
    headers: Headers,
    payload: Json,
  ): payload is CaptchaRejectedPayload {
    return (
      super.is(status, headers, payload) && payload.error === 'captcha_rejected'
    )
  }
}

/**
 * Any HTTP 429 response, regardless of its OAuth error code.
 */
export class RateLimitExceededError<
  P extends OAuthErrorPayload = OAuthErrorPayload,
> extends OAuthErrorResponse<P> {
  override name = 'RateLimitExceededError'
  override msg = msg`Too many attempts.`

  /** Number of seconds to wait before retrying, if known. */
  public readonly retryAfter?: number

  constructor(
    status: number,
    headers: Headers,
    payload: P,
    message = payload.error_description || 'Rate limit exceeded',
  ) {
    super(status, headers, payload, message)
    this.retryAfter = parseRetryAfter(headers.get('retry-after'))
  }

  static is(
    status: number,
    headers: Headers,
    payload: Json,
  ): payload is OAuthErrorPayload {
    return super.is(status, headers, payload) && status === 429
  }
}

/**
 * @returns the number of seconds to wait, if the `Retry-After` header value
 * (delay in seconds or HTTP date) is valid
 */
function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined

  const seconds = Number(value)
  if (Number.isInteger(seconds) && seconds >= 0) return seconds

  const date = Date.parse(value)
  if (!Number.isNaN(date)) {
    return Math.max(0, Math.ceil((date - Date.now()) / 1e3))
  }

  return undefined
}

export type UnknownAtprotoAccountPayload =
  OAuthErrorPayload<'unknown_atproto_account_error'> & {
    identifier: string
    issuer: string | undefined
  }
export class UnknownAtprotoAccountError<
  P extends UnknownAtprotoAccountPayload = UnknownAtprotoAccountPayload,
> extends OAuthErrorResponse<P> {
  override msg = this.issuer
    ? msg`The account "${this.payload.identifier}" is hosted elsewhere.`
    : msg`An email address is required.`

  get issuer() {
    return this.payload.issuer
  }

  get identifier() {
    return this.payload.identifier
  }

  static is(
    status: number,
    headers: Headers,
    payload: Json,
  ): payload is UnknownAtprotoAccountPayload {
    return (
      super.is(status, headers, payload) &&
      payload.error === 'unknown_atproto_account_error' &&
      typeof payload['identifier'] === 'string' &&
      (typeof payload['issuer'] === 'string' || payload['issuer'] === undefined)
    )
  }
}

export type InvalidInviteCodePayload = InvalidRequestPayload & {
  error_description: `This invite code is invalid.${string}`
}
export class InvalidInviteCodeError<
  P extends InvalidInviteCodePayload = InvalidInviteCodePayload,
> extends InvalidRequestError<P> {
  msg = msg`The invite code is not valid`

  constructor(status: number, headers: Headers, payload: P) {
    super(status, headers, payload)
  }

  static is(
    status: number,
    headers: Headers,
    payload: Json,
  ): payload is InvalidInviteCodePayload {
    return (
      super.is(status, headers, payload) &&
      payload.error_description != null &&
      payload.error_description.startsWith('This invite code is invalid.')
    )
  }
}

export type RequestExpiredPayload = AccessDeniedPayload & {
  error_description: 'This request has expired'
}
export class RequestExpiredError<
  P extends RequestExpiredPayload = RequestExpiredPayload,
> extends AccessDeniedError<P> {
  override msg = msg`This sign-in session has expired`

  static is(
    status: number,
    headers: Headers,
    payload: Json,
  ): payload is RequestExpiredPayload {
    return (
      super.is(status, headers, payload) &&
      payload.error_description === 'This request has expired'
    )
  }
}

export type InvalidCredentialsPayload = InvalidRequestPayload & {
  error_description: 'Invalid identifier or password'
}
export class InvalidCredentialsError<
  P extends InvalidCredentialsPayload = InvalidCredentialsPayload,
> extends InvalidRequestError<P> {
  override msg = msg`Wrong identifier or password`

  static is(
    status: number,
    headers: Headers,
    payload: Json,
  ): payload is InvalidCredentialsPayload {
    return (
      super.is(status, headers, payload) &&
      payload.error_description === 'Invalid identifier or password'
    )
  }
}

export type UnknownRequestPayload = InvalidRequestPayload & {
  error_description: 'Unknown request_uri'
}
export class UnknownRequestUriError<
  P extends UnknownRequestPayload = UnknownRequestPayload,
> extends InvalidRequestError<P> {
  override msg = msg`This sign-in session has expired`

  static is(
    status: number,
    headers: Headers,
    payload: Json,
  ): payload is UnknownRequestPayload {
    return (
      super.is(status, headers, payload) &&
      payload.error_description === 'Unknown request_uri'
    )
  }
}
export type EmailTakenPayload = InvalidRequestPayload & {
  error_description: 'Email already taken'
}
export class EmailTakenError<
  P extends EmailTakenPayload = EmailTakenPayload,
> extends InvalidRequestError<P> {
  override msg = msg`This email is already used`

  static is(
    status: number,
    headers: Headers,
    payload: Json,
  ): payload is EmailTakenPayload {
    return (
      super.is(status, headers, payload) &&
      payload.error_description === 'Email already taken'
    )
  }
}
