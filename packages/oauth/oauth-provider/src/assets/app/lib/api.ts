import { Account } from '../backend-types.ts'
import {
  JsonClient,
  JsonErrorPayload,
  JsonErrorResponse,
} from './json-client.ts'

export type { Options } from './json-client.ts'

export type AcceptData = {
  sub: string
}

export type SignInData = {
  locale: string
  username: string
  password: string
  emailOtp?: string
  remember?: boolean
}

export type SignUpData = {
  locale: string
  handle: string
  email: string
  password: string
  inviteCode?: string
  hcaptchaToken?: string
}

export type InitiatePasswordResetData = {
  locale: string
  email: string
}

export type ConfirmResetPasswordData = {
  token: string
  password: string
}

export type VerifyHandleAvailabilityData = {
  handle: string
}

export type SessionResponse = {
  account: Account
  consentRequired: boolean
}

export class Api extends JsonClient<{
  '/verify-handle-availability': {
    input: VerifyHandleAvailabilityData
    output: void
  }
  '/sign-up': {
    input: SignUpData
    output: SessionResponse
  }
  '/sign-in': {
    input: SignInData
    output: SessionResponse
  }
  '/reset-password-request': {
    input: InitiatePasswordResetData
    output: void
  }
  '/reset-password-confirm': {
    input: ConfirmResetPasswordData
    output: void
  }
}> {
  constructor(csrfToken: string) {
    const baseUrl = new URL('/oauth/authorize', window.origin).toString()
    super(baseUrl, csrfToken)
  }

  public buildAcceptUrl(data: AcceptData): URL {
    const url = new URL(`${this.baseUrl}/accept`)
    url.searchParams.set('account_sub', data.sub)
    url.searchParams.set('csrf_token', this.csrfToken)
    return url
  }

  public buildRejectUrl(): URL {
    const url = new URL(`${this.baseUrl}/reject`)
    url.searchParams.set('csrf_token', this.csrfToken)
    return url
  }

  public static override parseError(
    json: unknown,
  ): undefined | JsonErrorResponse {
    // @NOTE Most specific errors first !
    if (SecondAuthenticationFactorRequiredError.is(json)) {
      return new SecondAuthenticationFactorRequiredError(json)
    }
    if (InvalidCredentialsError.is(json)) {
      return new InvalidCredentialsError(json)
    }
    if (HandleUnavailableError.is(json)) {
      return new HandleUnavailableError(json)
    }
    if (EmailTakenError.is(json)) {
      return new EmailTakenError(json)
    }
    if (RequestExpiredError.is(json)) {
      return new RequestExpiredError(json)
    }
    if (UnknownRequestUriError.is(json)) {
      return new UnknownRequestUriError(json)
    }
    if (InvalidRequestError.is(json)) {
      return new InvalidRequestError(json)
    }
    if (AccessDeniedError.is(json)) {
      return new AccessDeniedError(json)
    }
    return super.parseError(json)
  }
}

export type AccessDeniedPayload = JsonErrorPayload<'access_denied'>
export class AccessDeniedError<
  P extends AccessDeniedPayload = AccessDeniedPayload,
> extends JsonErrorResponse<P> {
  constructor(
    payload: P,
    message = payload.error_description || 'Access denied',
  ) {
    super(payload, message)
  }

  static is(json: unknown): json is AccessDeniedPayload {
    return super.is(json) && json.error === 'access_denied'
  }
}

export type InvalidRequestPayload = JsonErrorPayload<'invalid_request'>
export class InvalidRequestError<
  P extends InvalidRequestPayload = InvalidRequestPayload,
> extends JsonErrorResponse<P> {
  constructor(
    payload: P,
    message = payload.error_description || 'Invalid request',
  ) {
    super(payload, message)
  }

  static is(json: unknown): json is InvalidRequestPayload {
    return super.is(json) && json.error === 'invalid_request'
  }
}

export type RequestExpiredPayload = AccessDeniedPayload & {
  error_description: 'This request has expired'
}
export class RequestExpiredError<
  P extends RequestExpiredPayload = RequestExpiredPayload,
> extends AccessDeniedError<P> {
  static is(json: unknown): json is RequestExpiredPayload {
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
  static is(json: unknown): json is InvalidCredentialsPayload {
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
  static is(json: unknown): json is UnknownRequestPayload {
    return super.is(json) && json.error_description === 'Unknown request_uri'
  }
}
export type EmailTakenPayload = InvalidRequestPayload & {
  error_description: 'Email already taken'
}
export class EmailTakenError<
  P extends EmailTakenPayload = EmailTakenPayload,
> extends InvalidRequestError<P> {
  static is(json: unknown): json is EmailTakenPayload {
    return super.is(json) && json.error_description === 'Email already taken'
  }
}

export type HandleUnavailablePayload =
  JsonErrorPayload<'handle_unavailable'> & {
    reason: 'syntax' | 'domain' | 'slur' | 'taken'
  }
export class HandleUnavailableError<
  P extends HandleUnavailablePayload = HandleUnavailablePayload,
> extends JsonErrorResponse<P> {
  constructor(
    payload: P,
    message = payload.error_description || 'That handle cannot be used',
  ) {
    super(payload, message)
  }

  get reason() {
    return this.payload.reason
  }

  static is(json: unknown): json is HandleUnavailablePayload {
    return (
      super.is(json) &&
      json.error === 'handle_unavailable' &&
      'reason' in json &&
      (json.reason === 'syntax' ||
        json.reason === 'domain' ||
        json.reason === 'slur' ||
        json.reason === 'taken')
    )
  }
}

export type SecondAuthenticationFactorRequiredPayload =
  JsonErrorPayload<'second_authentication_factor_required'> & {
    type: 'emailOtp'
    hint: string
  }
export class SecondAuthenticationFactorRequiredError<
  P extends
    SecondAuthenticationFactorRequiredPayload = SecondAuthenticationFactorRequiredPayload,
> extends JsonErrorResponse<P> {
  constructor(
    payload: P,
    message = payload.error_description ||
      `${payload.type} authentication factor required (hint: ${payload.hint})`,
  ) {
    super(payload, message)
  }

  get type() {
    return this.payload.type
  }
  get hint() {
    return this.payload.hint
  }

  static is(json: unknown): json is SecondAuthenticationFactorRequiredPayload {
    return (
      super.is(json) &&
      json.error === 'second_authentication_factor_required' &&
      'type' in json &&
      json.type === 'emailOtp' &&
      'hint' in json &&
      typeof json.hint === 'string'
    )
  }
}
