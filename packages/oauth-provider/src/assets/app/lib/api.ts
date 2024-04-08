import {
  fetchFailureHandler,
  fetchJsonProcessor,
  fetchOkProcessor,
} from '@atproto/fetch'

import { Account, Info, Session } from '../types'

export class Api {
  constructor(
    private requestUri: string,
    private clientId: string,
    private csrfToken: string,
    private newSessionsRequireConsent: boolean,
  ) {}

  async signIn(credentials: {
    username: string
    password: string
    remember?: boolean
  }): Promise<Session> {
    const { json } = await fetch('/oauth/authorize/sign-in', {
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
      .then(fetchOkProcessor(), fetchFailureHandler)
      .then(fetchJsonProcessor<{ account: Account; info: Info }>())

    return {
      account: json.account,
      info: json.info,

      selected: true,
      consentRequired:
        this.newSessionsRequireConsent ||
        !json.info.authorizedClients.includes(this.clientId),
      loginRequired: false,
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
