import type express from 'express'
import { FeatureGate } from './gates'

/**
 * The user context passed to the feature gates client for evaluation and
 * tracking purposes.
 */
export type RawUserContext = {
  /**
   * The user's DID
   */
  viewer: string | null
  /**
   * The express request object, used to extract analytics headers for the user context
   */
  req: express.Request
}

/**
 * Extracted values from the `RawUserContext`. These values should match the
 * `attributes` we've configured for GrowthBook in our GB dashboard. We also
 * send these same values as properties in our analytics events, so we want to
 * make sure they are consistent.
 */
export type ParsedUserContext = {
  did?: string | null
  deviceId?: string | null
  sessionId?: string | null
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
    deviceId: string | undefined
    sessionId: string | undefined
  }
  session: {
    did: string | undefined
  }
}

/**
 * Pre-evaluated feature gates map, the result of
 * `ctx.FeatureGatesClient.checkGates()`
 */
export type CheckedFeatureGatesMap = Map<FeatureGate, boolean>
