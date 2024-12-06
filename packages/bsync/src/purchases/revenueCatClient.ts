import { z } from 'zod'

// Reference: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields#events-format
export type RcEventBody = {
  api_version: '1.0'
  event: {
    app_user_id: string
    type: string
  }
}

export const rcEventBodySchema = z.object({
  api_version: z.literal('1.0'),
  event: z.object({
    app_user_id: z.string(),
    type: z.string(),
  }),
})

// Reference: https://www.revenuecat.com/docs/api-v1#tag/customers
export type RcGetSubscriberResponse = {
  subscriber: RcSubscriber
}

export type RcSubscriber = {
  entitlements: {
    [entitlementIdentifier: string]: RcEntitlement
  }
  subscriptions: {
    [productIdentifier: string]: RcSubscription
  }
  subscriber_attributes: {
    [attributeName: string]: {
      value: string
    }
  }
}

export type RcEntitlement = {
  expires_date: string
}

export type RcSubscription = {
  auto_resume_date: string | null
  expires_date: string
  original_purchase_date: string
  // product_plan_identifier is only present for Android subscriptions.
  product_plan_identifier?: string
  purchase_date: string
  store: 'play_store' | 'app_store' | 'stripe'
  unsubscribe_detected_at: string | null
}

type RevenueCatClientOpts = {
  v1ApiKey: string
  v1ApiUrl: string
  webhookAuthorization: string
}

export class RevenueCatClient {
  private v1ApiKey: string
  private v1ApiUrl: string
  private webhookAuthorization: string

  constructor({
    v1ApiKey,
    v1ApiUrl,
    webhookAuthorization,
  }: RevenueCatClientOpts) {
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

  getSubscriber(did: string): Promise<RcGetSubscriberResponse> {
    return this.fetch<RcGetSubscriberResponse>(
      `/subscribers/${encodeURIComponent(did)}`,
    )
  }

  isWebhookAuthorizationValid(authorization: string | undefined): boolean {
    return authorization === this.webhookAuthorization
  }
}
