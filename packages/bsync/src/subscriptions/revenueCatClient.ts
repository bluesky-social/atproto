type Config = {
  v1ApiKey: string
  v1ApiUrl: string
  webhookAuthorization: string
}

// Reference: https://www.revenuecat.com/docs/api-v1#tag/customers
export type GetSubscriberResponse = {
  subscriber: Subscriber
}

export type Subscriber = {
  entitlements: {
    [entitlementIdentifier: string]: Entitlement
  }
}

export type Entitlement = {
  expires_date: string
}

export class RevenueCatClient {
  private v1ApiKey: string
  private v1ApiUrl: string
  private webhookAuthorization: string

  constructor({ v1ApiKey, v1ApiUrl, webhookAuthorization }: Config) {
    this.v1ApiKey = v1ApiKey
    this.v1ApiUrl = v1ApiUrl
    this.webhookAuthorization = webhookAuthorization
  }

  private async fetch<T extends object>(
    path: string,
    method: string = 'GET',
  ): Promise<T> {
    const url = new URL(path, this.v1ApiUrl)
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.v1ApiKey}`,
      },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch ${path}: ${res.statusText}`)
    }

    return res.json() as T
  }

  private getSubscriber(did: string): Promise<GetSubscriberResponse> {
    return this.fetch<GetSubscriberResponse>(
      `/subscribers/${encodeURIComponent(did)}`,
    )
  }

  async getEntitlementIdentifiers(did: string): Promise<string[]> {
    const { subscriber } = await this.getSubscriber(did)

    const now = Date.now()
    return Object.entries(subscriber.entitlements)
      .filter(
        ([_, entitlement]) =>
          now < new Date(entitlement.expires_date).valueOf(),
      )
      .map(([entitlementIdentifier]) => entitlementIdentifier)
  }

  isWebhookAuthorizationValid(authorization: string | undefined): boolean {
    return authorization === this.webhookAuthorization
  }
}
