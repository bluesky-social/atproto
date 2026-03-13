import { Gate } from './gates'

/**
 * The user context passed to the feature gates client for evaluation and
 * tracking purposes.
 */
export type UserContext = {
  did?: string | null
  deviceId?: string | null
  sessionId?: string | null
}

/**
 * User context that has been normalized to ensure all required properties are
 * present and have fallback values. This is the format that we expect to use
 * for all feature gate evaluations and analytics tracking.
 */
export type NormalizedUserContext = {
  did?: string
  deviceId: string
  sessionId: string
}

/**
 * This loosely matches the metadata we send from the client for analytics
 * events. We want to make sure we have the same properties in both places so
 * that we can correlate feature gate evaluations with analytics events.
 *
 * @see https://github.com/bluesky-social/social-app/blob/76109a58dc7aafccdfbd07a81cbd9925e065d1c0/src/analytics/metadata.ts
 */
export type TrackingMetadata = {
  base: {
    deviceId: string
    sessionId: string
  }
  session: {
    did: string | undefined
  }
}

/**
 * Pre-evaluated feature gates map, the result of
 * `ctx.FeatureGatesClient.checkGates()`
 */
export type CheckedFeatureGatesMap = Map<Gate, boolean>
