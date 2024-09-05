import { FetchResponseError, Json } from '@atproto-labs/fetch'

import { Account, Session } from '../backend-data'

export class Api {
  constructor(
    private requestUri: string,
    private clientId: string,
    private csrfToken: string,
    private newSessionsRequireConsent: boolean,
  ) {}

  async signIn(credentials: {
    username: string
    siweSignature: string
    remember?: boolean
  }): Promise<Session> {
    const response = await fetch('/oauth/authorize/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'same-origin',
      body: JSON.stringify({
        csrf_token: this.csrfToken,
        request_uri: this.requestUri,
        client_id: this.clientId,
        credentials,
      }),
    })

    const json: Json = await response.json()

    if (response.ok) {
      const data = json as {
        account: Account
        consentRequired: boolean
      }

      return {
        account: data.account,

        selected: true,
        loginRequired: false,
        consentRequired: this.newSessionsRequireConsent || data.consentRequired,
      }
    } else if (
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
      throw new FetchResponseError(response)
    }
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
