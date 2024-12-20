import { FetchResponseError, Json, peekJson } from '@atproto-labs/fetch'

import { Account, Session } from '../backend-data'

export class Api {
  constructor(
    private requestUri: string,
    private clientId: string,
    private csrfToken: string,
    private newSessionsRequireConsent: boolean,
  ) {}

  async fetch<R extends Json = Json>(path: string, payload: Json): Promise<R> {
    const response = await fetch(`/oauth/authorize${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.csrfToken,
      },
      mode: 'same-origin',
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      try {
        return (await response.json()) as R
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : undefined
        throw new FetchResponseError(response, undefined, message, { cause })
      }
    }

    try {
      const json = await peekJson(response).catch(() => undefined)

      if (
        response.status === 400 &&
        json?.['error'] === 'invalid_request' &&
        json?.['error_description'] === 'Invalid credentials'
      ) {
        throw new InvalidCredentialsError()
      } else if (
        response.status === 401 &&
        json?.['error'] === 'second_authentication_factor_required'
      ) {
        const data = json as {
          type: 'emailOtp'
          hint: string
        }

        throw new SecondAuthenticationFactorRequiredError(data.type, data.hint)
      } else {
        throw await FetchResponseError.from(response)
      }
    } finally {
      response.body?.cancel()
    }
  }

  async signIn(credentials: {
    username: string
    password: string
    remember?: boolean
  }): Promise<Session> {
    const json = await this.fetch<{
      account: Account
      consentRequired: boolean
    }>('/sign-in', {
      request_uri: this.requestUri,
      client_id: this.clientId,
      credentials,
    })

    return {
      account: json.account,

      selected: true,
      loginRequired: false,
      consentRequired: this.newSessionsRequireConsent || json.consentRequired,
    }
  }

  async resetPasswordInit(email: string) {
    return this.fetch<{ ok: true }>('/reset-password-init', { email })
  }

  async resetPasswordConfirm(code: string, newPassword: string) {
    return this.fetch<{ ok: true }>('/reset-password-confirm', {
      code,
      newPassword,
    })
  }

  async accept(account: Account): Promise<URL> {
    const url = new URL('/oauth/authorize/accept', window.origin)
    url.searchParams.set('request_uri', this.requestUri)
    url.searchParams.set('account_sub', account.sub)
    url.searchParams.set('client_id', this.clientId)
    url.searchParams.set('csrf_token', this.csrfToken)

    return url
  }

  async reject(): Promise<URL> {
    const url = new URL('/oauth/authorize/reject', window.origin)
    url.searchParams.set('request_uri', this.requestUri)
    url.searchParams.set('client_id', this.clientId)
    url.searchParams.set('csrf_token', this.csrfToken)

    return url
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials')
  }
}

export class SecondAuthenticationFactorRequiredError extends Error {
  constructor(
    public type: 'emailOtp',
    public hint: string,
  ) {
    super(`${type} authentication factor required (hint: ${hint})`)
  }
}
