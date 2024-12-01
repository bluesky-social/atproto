import axios, { AxiosInstance } from 'axios'

type Config = {
  apiKey: string
  url: string
  webhookAuthorization: string | undefined
}

type GetSubscriberResponse = {
  subscriber: {
    entitlements: {
      [entitlementIdentifier: string]: unknown
    }
  }
}

export class RevenueCatClient {
  private webhookAuthorization: string | undefined
  private axios: AxiosInstance

  constructor({ apiKey, url, webhookAuthorization }: Config) {
    this.axios = axios.create({
      baseURL: url,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    this.webhookAuthorization = webhookAuthorization
  }

  async getSubscriber(did: string): Promise<GetSubscriberResponse> {
    const { data } = await this.axios.get(
      `/subscribers/${encodeURIComponent(did)}`,
    )

    return data as GetSubscriberResponse
  }

  isWebhookAuthorizationValid(authorization: string | undefined): boolean {
    // It is either valid if the authorization is:
    //   1. not configured and undefined in the request.
    //   2. configured and matches the request.
    return authorization === this.webhookAuthorization
  }
}
