type Config = {
  apiKey: string
  url: string
  webhookAuthorization: string | undefined
}

export type Subscriber = {
  entitlements: {
    [entitlementIdentifier: string]: unknown
  }
}

export type GetSubscriberResponse = {
  subscriber: Subscriber
}

export class RevenueCatClient {
  private apiKey: string
  private url: string
  private webhookAuthorization: string | undefined

  constructor({ apiKey, url, webhookAuthorization }: Config) {
    this.apiKey = apiKey
    this.url = url
    this.webhookAuthorization = webhookAuthorization
  }

  private async fetch<T extends object>(
    path: string,
    method: string = 'GET',
  ): Promise<T> {
    const res = await fetch(`${this.url}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch ${path}: ${res.statusText}`)
    }

    return res.json() as T
  }

  async getSubscriber(did: string): Promise<GetSubscriberResponse> {
    return this.fetch<GetSubscriberResponse>(
      `/subscribers/${encodeURIComponent(did)}`,
    )
  }

  isWebhookAuthorizationValid(authorization: string | undefined): boolean {
    // It is either valid if the authorization is:
    //   1. not configured and undefined in the request.
    //   2. configured and matches the request.
    return authorization === this.webhookAuthorization
  }
}
