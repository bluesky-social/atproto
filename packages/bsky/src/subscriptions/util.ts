import { Subscriber } from './revenueCat'

export const entitlementIdentifiersFromSubscriber = (
  subscriber: Subscriber,
): string[] => {
  const now = Date.now()
  return Object.entries(subscriber.entitlements)
    .filter(
      ([_, entitlement]) => now < new Date(entitlement.expires_date).valueOf(),
    )
    .map(([entitlementIdentifier]) => entitlementIdentifier)
}
