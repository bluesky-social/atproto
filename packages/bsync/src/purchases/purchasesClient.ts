import { Subscription } from '../proto/bsync_pb'
import { RcSubscription, RevenueCatClient } from './revenueCatClient'

type PlatformId = 'web' | 'ios' | 'android'

type SubscriptionGroupId = 'core'

type SubscriptionOfferingId = 'coreMonthly' | 'coreAnnual'

const assertSubscriptionGroup: (
  group: string,
) => asserts group is SubscriptionGroupId = (group: string) => {
  if (['core'].includes(group)) {
    return
  }
  throw new Error(`invalid subscription group: '${group}'`)
}

const assertPlatform: (platform: string) => asserts platform is PlatformId = (
  platform: string,
) => {
  if (['web', 'ios', 'android'].includes(platform)) {
    return
  }
  throw new Error(`invalid platform: '${platform}'`)
}

export type PurchasesClientOpts = {
  revenueCatV1ApiKey: string
  revenueCatV1ApiUrl: string
  revenueCatWebhookAuthorization: string
  stripePriceIdMonthly: string
  stripePriceIdAnnual: string
  stripeProductIdMonthly: string
  stripeProductIdAnnual: string
}

const mapStoreToPlatform = (store: string): PlatformId | undefined => {
  switch (store) {
    case 'stripe':
      return 'web'
    case 'app_store':
      return 'ios'
    case 'play_store':
      return 'android'
    default:
      return undefined
  }
}

export class PurchasesClient {
  private revenueCatClient: RevenueCatClient
  private STRIPE_PRODUCTS: {
    [subscriptionOfferingId in SubscriptionOfferingId]: string
  }

  /**
   * All of our purchaseable product IDs for all platforms.
   */
  private PRODUCTS: {
    [platform in PlatformId]: {
      [subscriptionOfferingId in SubscriptionOfferingId]: string
    }
  }

  /**
   * Manual groupings of products into "Subscription Groups", mimicking the way
   * Apple does it.
   */
  private GROUPS: {
    [group in SubscriptionGroupId]: {
      [platform in PlatformId]: {
        id: SubscriptionOfferingId
        product: string
      }[]
    }
  }

  constructor(opts: PurchasesClientOpts) {
    this.revenueCatClient = new RevenueCatClient({
      v1ApiKey: opts.revenueCatV1ApiKey,
      v1ApiUrl: opts.revenueCatV1ApiUrl,
      webhookAuthorization: opts.revenueCatWebhookAuthorization,
    })

    this.STRIPE_PRODUCTS = {
      coreMonthly: opts.stripeProductIdMonthly,
      coreAnnual: opts.stripeProductIdAnnual,
    }

    this.PRODUCTS = {
      web: {
        coreMonthly: opts.stripePriceIdMonthly,
        coreAnnual: opts.stripePriceIdAnnual,
      },
      ios: {
        coreMonthly: 'bluesky_plus_core_v1_monthly',
        coreAnnual: 'bluesky_plus_core_v1_annual',
      },
      android: {
        coreMonthly: 'bluesky_plus_core_v1:monthly',
        coreAnnual: 'bluesky_plus_core_v1:annual',
      },
    }

    this.GROUPS = {
      core: {
        web: [
          { id: 'coreMonthly', product: this.PRODUCTS.web.coreMonthly },
          { id: 'coreAnnual', product: this.PRODUCTS.web.coreAnnual },
        ],
        ios: [
          { id: 'coreMonthly', product: this.PRODUCTS.ios.coreMonthly },
          { id: 'coreAnnual', product: this.PRODUCTS.ios.coreAnnual },
        ],
        android: [
          { id: 'coreMonthly', product: this.PRODUCTS.android.coreMonthly },
          { id: 'coreAnnual', product: this.PRODUCTS.android.coreAnnual },
        ],
      },
    }
  }

  isRcWebhookAuthorizationValid(authorization: string | undefined): boolean {
    return this.revenueCatClient.isWebhookAuthorizationValid(authorization)
  }

  getSubscriptionGroup(group: string, platform: string) {
    assertSubscriptionGroup(group)
    assertPlatform(platform)
    return this.GROUPS[group][platform]
  }

  async getEntitlements(did: string): Promise<string[]> {
    const { subscriber } = await this.revenueCatClient.getSubscriber(did)

    const now = Date.now()
    return Object.entries(subscriber.entitlements)
      .filter(
        ([_, entitlement]) =>
          now < new Date(entitlement.expires_date).valueOf(),
      )
      .map(([entitlementIdentifier]) => entitlementIdentifier)
  }

  async getSubscriptionsAndEmail(
    did: string,
  ): Promise<{ subscriptions: Subscription[]; email?: string }> {
    const { subscriber } = await this.revenueCatClient.getSubscriber(did)

    const email = subscriber.subscriber_attributes.email?.value

    const subscriptions = Object.entries(subscriber.subscriptions)

    return {
      email: email,
      subscriptions: subscriptions
        .map(this.createSubscriptionObject)
        .filter(Boolean) as Subscription[],
    }
  }

  private createSubscriptionObject = ([productId, s]: [
    string,
    RcSubscription,
  ]): Subscription | undefined => {
    const platform = mapStoreToPlatform(s.store)
    if (!platform) {
      return undefined
    }

    const fullProductId =
      platform === 'android'
        ? `${productId}:${s.product_plan_identifier}`
        : productId

    const group = this.mapStoreIdentifierToSubscriptionGroup(fullProductId)
    if (!group) {
      return undefined
    }

    const now = new Date()
    const expiresAt = new Date(s.expires_date)

    let status = 'unknown'
    if (s.auto_resume_date) {
      if (now > expiresAt) {
        status = 'paused'
      }
    } else if (now > expiresAt) {
      status = 'expired'
    } else if (now < expiresAt) {
      status = 'active'
    }

    let renewalStatus = 'unknown'
    if (s.auto_resume_date) {
      if (now < expiresAt) {
        renewalStatus = 'will_pause'
      } else if (now > expiresAt) {
        renewalStatus = 'will_renew'
      }
    } else if (now < expiresAt) {
      renewalStatus = 'will_renew'
      if (s.unsubscribe_detected_at) {
        renewalStatus = 'will_not_renew'
      }
    } else if (now > expiresAt) {
      renewalStatus = 'will_not_renew'
    }

    let periodEndsAt = s.expires_date
    if (s.auto_resume_date) {
      if (now > expiresAt) {
        periodEndsAt = s.auto_resume_date
      }
    }

    const offering =
      this.mapStoreIdentifierToSubscriptionOfferingId(fullProductId)
    if (!offering) {
      return undefined
    }

    return Subscription.fromJson({
      status,
      renewalStatus,
      group,
      platform,
      offering,
      periodEndsAt: periodEndsAt,
      periodStartsAt: s.purchase_date,
      purchasedAt: s.original_purchase_date,
    })
  }

  private mapStoreIdentifierToSubscriptionOfferingId = (
    identifier: string,
  ): SubscriptionOfferingId | undefined => {
    switch (identifier) {
      case this.STRIPE_PRODUCTS.coreMonthly:
      case this.PRODUCTS.ios.coreMonthly:
      case this.PRODUCTS.android.coreMonthly:
        return 'coreMonthly'
      case this.STRIPE_PRODUCTS.coreAnnual:
      case this.PRODUCTS.ios.coreAnnual:
      case this.PRODUCTS.android.coreAnnual:
        return 'coreAnnual'
      default:
        return undefined
    }
  }

  private mapStoreIdentifierToSubscriptionGroup = (
    identifier: string,
  ): SubscriptionGroupId | undefined => {
    switch (identifier) {
      case this.STRIPE_PRODUCTS.coreMonthly:
      case this.STRIPE_PRODUCTS.coreAnnual:
      case this.PRODUCTS.ios.coreMonthly:
      case this.PRODUCTS.ios.coreAnnual:
      case this.PRODUCTS.android.coreMonthly:
      case this.PRODUCTS.android.coreAnnual:
        return 'core'
      default:
        return undefined
    }
  }
}
