import {
  API_ENDPOINT_PREFIX,
  ApiEndpoints,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from '@atproto/oauth-provider-api'
import { readCookie } from '../util/cookies.ts'
import {
  JsonClient,
  JsonErrorPayload,
  JsonErrorResponse,
} from './json-client.ts'

export type { Options } from './json-client.ts'

export class Api extends JsonClient<ApiEndpoints> {
  constructor() {
    const baseUrl = new URL(API_ENDPOINT_PREFIX, window.origin).toString()
    super(baseUrl, () => ({
      [CSRF_HEADER_NAME]: readCookie(CSRF_COOKIE_NAME),
    }))
  }

  // Override the parent's parseError method to handle expected error responses
  // and transform them into instances of the corresponding error classes.
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
    if (InvalidInviteCodeError.is(json)) {
      return new InvalidInviteCodeError(json)
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

export type InvalidInviteCodePayload = InvalidRequestPayload & {
  error_description: `This invite code is invalid.${string}`
}
export class InvalidInviteCodeError<
  P extends InvalidInviteCodePayload = InvalidInviteCodePayload,
> extends InvalidRequestError<P> {
  constructor(payload: P) {
    super(payload)
  }

  static is(json: unknown): json is InvalidInviteCodePayload {
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
