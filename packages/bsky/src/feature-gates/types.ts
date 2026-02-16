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
  stableId?: string | null
  sessionId?: string | null
}

/**
 * Pre-evaluated feature gates map, the result of `FeatureGates.checkGates()`
 */
export type CheckedFeatureGatesMap = Map<FeatureGate, boolean>
