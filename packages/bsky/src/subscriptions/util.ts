import { Subscriber } from './revenueCat'

export const entitlementIdentifiersFromSubscriber = (
  subscriber: Subscriber,
): string[] => {
  const now = Date.now()
  return Object.entries(subscriber.entitlements)
    .filter(([_, entitlement]) => {
      const expiresDate = new Date(entitlement.expires_date).valueOf()
      const gracePeriodExpiresDate = entitlement.grace_period_expires_date
        ? new Date(entitlement.grace_period_expires_date).valueOf()
        : expiresDate

      const expirationMs = Math.max(expiresDate, gracePeriodExpiresDate)

      return now < expirationMs
    })
    .map(([entitlementIdentifier]) => entitlementIdentifier)
}
