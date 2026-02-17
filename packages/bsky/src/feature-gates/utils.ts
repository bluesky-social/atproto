import { type UserContext as GrowthBookUserContext } from '@growthbook/growthbook'
import { ParsedUserContext, RawUserContext, TrackingMetadata } from './types'

/**
 * These need to match what the client sends
 */
const ANALYTICS_HEADER_DEVICE_ID = 'X-Bsky-Device-Id'
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
    deviceId: userContext.req.header(ANALYTICS_HEADER_DEVICE_ID),
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
    deviceId: userContext.attributes?.deviceId,
    sessionId: userContext.attributes?.sessionId,
  }
}

/**
 * Convert the `ParsedUserContext` into the `TrackingMetadata` format that we
 * use for our analytics events. This ensures that we have the same user
 * properties as we do for events from our client app.
 */
export function parsedUserContextToTrackingMetadata(
  parsedUserContext: ParsedUserContext,
): TrackingMetadata {
  return {
    base: {
      deviceId: parsedUserContext.deviceId ?? undefined,
      sessionId: parsedUserContext.sessionId ?? undefined,
    },
    session: {
      did: parsedUserContext.did ?? undefined,
    },
  }
}
