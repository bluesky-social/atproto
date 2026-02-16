import { type UserContext as GrowthBookUserContext } from '@growthbook/growthbook'
import { ParsedUserContext, RawUserContext } from './types'

const ANALYTICS_HEADER_STABLE_ID = 'X-Bsky-Stable-Id'
const ANALYTICS_HEADER_SESSION_ID = 'X-Bsky-Session-Id'

/**
 * Parse the `RawUserContext` into a `ParsedUserContext` that is used as
 * GrowthBook `attributes` as well as the metadata payload for our analytics
 * events. This ensures that the same user properties are used for both feature
 * gate targeting and analytics.
 */
export function parseRawUserContext(
  userContext: RawUserContext,
): ParsedUserContext {
  return {
    did: userContext.viewer,
    stableId: userContext.req.header(ANALYTICS_HEADER_STABLE_ID),
    sessionId: userContext.req.header(ANALYTICS_HEADER_SESSION_ID),
  }
}

/**
 * Extract the `ParsedUserContext` from the GrowthBook `UserContext`, which we
 * passed into `isOn` as `attributes`.
 */
export function extractParsedUserContextFromGrowthBookUserContext(
  userContext: GrowthBookUserContext,
): ParsedUserContext {
  return {
    did: userContext.attributes?.did,
    stableId: userContext.attributes?.stableId,
    sessionId: userContext.attributes?.sessionId,
  }
}
