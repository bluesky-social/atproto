import { type UserContext as GrowthBookUserContext } from '@growthbook/growthbook'
import crypto from 'node:crypto'
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
  const did = userContext.viewer

  // prioritize passthrough header
  let deviceId = userContext.req.header(ANALYTICS_HEADER_DEVICE_ID)
  if (!deviceId) {
    if (did) {
      /*
       * If we don't have a device header, fall back to the DID. Our event
       * proxy ensures ordering based on this deviceId (also called a stableId
       * in the proxy), so if we have a DID, we want to use it to ensure client
       * and server events are properly ordered.
       */
      deviceId = did
    } else {
      /*
       * Without any better option for identifying the user, we generate a
       * random deviceId.
       */
      deviceId = `anon-${crypto.randomUUID()}`
    }
  }

  // prioritize passthrough header
  let sessionId = userContext.req.header(ANALYTICS_HEADER_SESSION_ID)
  if (!sessionId) {
    /*
     * Without any better option for identifying the user, we generate a
     * random deviceId.
     */
    sessionId = `anon-${crypto.randomUUID()}`
  }

  return {
    did,
    deviceId,
    sessionId,
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
