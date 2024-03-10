import { SignInFormOutput } from '../components/sign-in-form'
import { Account, SignInInfo } from '../types'

export type SignInResponse = {
  account: Account
  info: SignInInfo
}

export class Api {
  constructor(
    private requestUri: string,
    private clientId: string,
    private csrfToken: string,
  ) {}

  async signIn(credentials: SignInFormOutput): Promise<SignInResponse> {
    const r = await fetch('/oauth/authorize/sign-in', {
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
    const json = await r.json()

    // TODO: better error handling
    if (!r.ok) throw new Error(json.error || 'Error', { cause: json })

    return json as SignInResponse
  }

  accept(account: Account) {
    const url = new URL('/oauth/authorize/accept', window.origin)
    url.searchParams.set('request_uri', this.requestUri)
    url.searchParams.set('account_sub', account.sub)
    url.searchParams.set('client_id', this.clientId)
    url.searchParams.set('csrf_token', this.csrfToken)

    window.location.href = url.href
  }

  reject() {
    const url = new URL('/oauth/authorize/reject', window.origin)
    url.searchParams.set('request_uri', this.requestUri)
    url.searchParams.set('client_id', this.clientId)
    url.searchParams.set('csrf_token', this.csrfToken)

    window.location.href = url.href
  }
}
