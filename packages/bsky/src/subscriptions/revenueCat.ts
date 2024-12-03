type Config = {
  apiKey: string
  url: string
  webhookAuthorization: string
}

// Reference: https://www.revenuecat.com/docs/api-v1#tag/customers
export type Entitlement = {
  expires_date: string
}

export type Subscriber = {
  entitlements: {
    [entitlementIdentifier: string]: Entitlement
  }
}

export type GetSubscriberResponse = {
  subscriber: Subscriber
}

export class RevenueCatClient {
  private apiKey: string
  private url: string
  private webhookAuthorization: string

  constructor({ apiKey, url, webhookAuthorization }: Config) {
    this.apiKey = apiKey
    this.url = url
    this.webhookAuthorization = webhookAuthorization
  }

  private async fetch<T extends object>(
    path: string,
    method: string = 'GET',
  ): Promise<T> {
    const url = new URL(path, this.url)
    const res = await fetch(url, {
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
    return authorization === this.webhookAuthorization
  }
}
