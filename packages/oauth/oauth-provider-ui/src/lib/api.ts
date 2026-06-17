import { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import {
  AccountSessionsInput,
  type ApiEndpoints,
  ConfirmAccountDeletionInput,
  ConfirmEmailUpdateInput,
  ConfirmEmailVerificationInput,
  type ConfirmResetPasswordInput,
  DeactivateAccountInput,
  type DidString,
  type HandleUnavailableReason,
  InitiateAccountDeletionInput,
  InitiateEmailUpdateInput,
  InitiateEmailVerificationInput,
  type InitiatePasswordResetInput,
  OAuthSessionsInput,
  ReactivateAccountInput,
  RevokeAccountSessionInput,
  RevokeOAuthSessionInput,
  type SignInInput,
  SignOutInput,
  type SignUpInput,
  type UpdateHandleInput,
  type VerifyHandleAvailabilityInput,
  isHandleUnavailableReason,
} from '@atproto/oauth-provider-api'
import { readCookie } from './cookies.ts'
import {
  Json,
  JsonClient,
  JsonClientOptions,
  JsonErrorResponse,
  Options,
} from './json-client.ts'

export type { Options } from './json-client.ts'
const CSRF_COOKIE_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'

const API_ENDPOINT_PREFIX = '/@atproto/oauth-provider/~api'

export type ApiOptions = JsonClientOptions<ApiEndpoints> & {
  locale: string
}

export type WithOptionalLocale<T extends { locale?: unknown }> = Omit<
  T,
  'locale'
> & { locale?: T['locale'] }

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
      username,
      password,
      emailOtp,
      remember,
      locale = this.locale,
    }: WithOptionalLocale<SignInInput>,
    options?: Options,
  ) {
    return this.fetch(
      'POST',
      '/sign-in',
      { username, password, emailOtp, remember, locale },
      options,
    )
  }

  async initiatePasswordReset(
    {
      email,
      locale = this.locale,
    }: WithOptionalLocale<InitiatePasswordResetInput>,
    options?: Options,
  ) {
    await this.fetch(
      'POST',
      '/reset-password-request',
      { email, locale },
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
    { token, password }: ConfirmResetPasswordInput,
    options?: Options,
  ) {
    await this.fetch(
      'POST',
      '/reset-password-confirm',
      { token, password },
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
      inviteCode,
      hcaptchaToken,
    }: WithOptionalLocale<SignUpInput>,
    options?: Options,
  ) {
    return this.fetch(
      'POST',
      '/sign-up',
      { locale, handle, email, password, inviteCode, hcaptchaToken },
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
    return parseApiErrorPayload(payload) ?? super.parseError(response, payload)
  }
}

export function parseApiErrorPayload(
  payload: unknown,
): OAuthErrorResponse | undefined {
  if (isOAuthErrorPayload(payload)) {
    for (const ErrorClass of [
      // @NOTE Most specific errors must come first!
      UnknownRequestUriError,
      SecondAuthenticationFactorRequiredError,
      InvalidCredentialsError,
      InvalidInviteCodeError,
      HandleUnavailableError,
      EmailTakenError,
      RequestExpiredError,
      UnauthorizedError,
      InvalidRequestError,
      AccessDeniedError,
    ] as Array<{
      is(payload: OAuthErrorPayload): boolean
      new (payload: any): OAuthErrorResponse
    }>) {
      if (ErrorClass.is(payload)) {
        return new ErrorClass(payload)
      }
    }

    return new OAuthErrorResponse(payload)
  }
}

export type OAuthErrorPayload<E extends string = string> = {
  error: E
  error_description?: string
} & Record<string, Json>

export function isOAuthErrorPayload<E extends string = string>(
  json: unknown,
  error: E,
): json is OAuthErrorPayload<E>
export function isOAuthErrorPayload(json: unknown): json is OAuthErrorPayload
export function isOAuthErrorPayload(json: unknown, error?: string): boolean {
  return (
    json != null &&
    typeof json === 'object' &&
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
    payload: P,
    message = payload.error_description,
    options?: ErrorOptions,
  ) {
    super(payload, message || `OAuth Error "${payload.error}"`, options)
    this.msg = OAuthErrorResponse.getMessageForError(payload.error)
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
        return msg`An unexpected error occurred. Please try again.`
    }
  }
}

export type UnauthorizedPayload = OAuthErrorPayload<'unauthorized'>
export class UnauthorizedError<
  P extends UnauthorizedPayload = UnauthorizedPayload,
> extends OAuthErrorResponse<P> {
  override msg = msg`This sign-in session has expired`

  constructor(payload: P) {
    super(payload, payload.error_description || 'Unauthorized')
  }

  static is(json: OAuthErrorPayload): json is UnauthorizedPayload {
    return json.error === 'unauthorized'
  }
}

export type AccessDeniedPayload = OAuthErrorPayload<'access_denied'>
export class AccessDeniedError<
  P extends AccessDeniedPayload = AccessDeniedPayload,
> extends OAuthErrorResponse<P> {
  override msg = msg`This authorization request has been denied. Please try again.`

  constructor(payload: P, message = payload.error_description) {
    super(payload, message || 'Access denied')
  }

  static is(json: OAuthErrorPayload): json is AccessDeniedPayload {
    return json.error === 'access_denied'
  }
}

export type InvalidRequestPayload = OAuthErrorPayload<'invalid_request'>
export class InvalidRequestError<
  P extends InvalidRequestPayload = InvalidRequestPayload,
> extends OAuthErrorResponse<P> {
  override msg = msg`The data you submitted is invalid. Please check the form and try again.`

  constructor(payload: P, message = payload.error_description) {
    super(payload, message || 'Invalid request')
  }

  static is(json: OAuthErrorPayload): json is InvalidRequestPayload {
    return json.error === 'invalid_request'
  }
}

export type HandleUnavailablePayload =
  OAuthErrorPayload<'handle_unavailable'> & {
    reason: HandleUnavailableReason
  }
export class HandleUnavailableError<
  P extends HandleUnavailablePayload = HandleUnavailablePayload,
> extends OAuthErrorResponse<P> {
  constructor(payload: P, message = payload.error_description) {
    super(payload, message || 'Handle unavailable')
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

  static is(json: OAuthErrorPayload): json is HandleUnavailablePayload {
    return (
      json.error === 'handle_unavailable' &&
      isHandleUnavailableReason(json['reason'])
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
  P extends
    SecondAuthenticationFactorRequiredPayload = SecondAuthenticationFactorRequiredPayload,
> extends OAuthErrorResponse<P> {
  constructor(payload: P, message = payload.error_description) {
    const { type, hint } = payload
    super(payload, message || `${type} auth factor required (hint: ${hint})`)
    this.msg = msg`A second authentication factor is required (${hint})`
  }

  get type() {
    return this.payload.type
  }
  get hint() {
    return this.payload.hint
  }

  static is(
    json: OAuthErrorPayload,
  ): json is SecondAuthenticationFactorRequiredPayload {
    return (
      json.error === 'second_authentication_factor_required' &&
      isSecondAuthFactorType(json['type']) &&
      typeof json['hint'] === 'string'
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

  constructor(payload: P) {
    super(payload)
  }

  static is(json: OAuthErrorPayload): json is InvalidInviteCodePayload {
    return (
      super.is(json) &&
      json.error_description != null &&
      json.error_description.startsWith('This invite code is invalid.')
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

  static is(json: OAuthErrorPayload): json is RequestExpiredPayload {
    return (
      super.is(json) && json.error_description === 'This request has expired'
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

  static is(json: OAuthErrorPayload): json is InvalidCredentialsPayload {
    return (
      super.is(json) &&
      json.error_description === 'Invalid identifier or password'
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

  static is(json: OAuthErrorPayload): json is UnknownRequestPayload {
    return super.is(json) && json.error_description === 'Unknown request_uri'
  }
}
export type EmailTakenPayload = InvalidRequestPayload & {
  error_description: 'Email already taken'
}
export class EmailTakenError<
  P extends EmailTakenPayload = EmailTakenPayload,
> extends InvalidRequestError<P> {
  override msg = msg`This email is already used`

  static is(json: OAuthErrorPayload): json is EmailTakenPayload {
    return super.is(json) && json.error_description === 'Email already taken'
  }
}
