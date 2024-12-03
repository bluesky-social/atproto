import { Subscriber } from './revenueCat'

export const entitlementIdentifiersFromSubscriber = (
  subscriber: Subscriber,
): string[] => Object.keys(subscriber.entitlements ?? {})
