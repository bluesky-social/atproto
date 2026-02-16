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
 * A simplified and parsed version of the user context, containing only the
 * relevant information for feature gate evaluation and tracking.
 */
export type ParsedUserContext = {
  did?: string | null
  deviceId?: string | null
  sessionId?: string | null
}

/**
 * Pre-evaluated feature gates map, the result of `FeatureGates.checkGates()`
 */
export type CheckedFeatureGatesMap = Map<FeatureGate, boolean>
