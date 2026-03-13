import crypto from 'node:crypto'
import { type UserContext as GrowthBookUserContext } from '@growthbook/growthbook'
import { NormalizedUserContext, TrackingMetadata, UserContext } from './types'

export function normalizeUserContext(
  userContext: UserContext,
): NormalizedUserContext {
  const did = userContext.did ?? undefined
  let deviceId = userContext.deviceId
  let sessionId = userContext.sessionId

  if (!deviceId) {
    /*
     * If we don't have a deviceId by other means, such as a request header,
     * fall back to the DID. Our event proxy ensures ordering based on this
     * deviceId (also called a stableId in the proxy), so if we have a DID, we
     * want to use it to ensure client and server events are properly ordered.
     *
     * Without any better option for identifying the user, we generate a
     * random deviceId.
     */
    deviceId = did ?? `anon-${crypto.randomUUID()}`
  }
  if (!sessionId) {
    /*
     * If we don't have a sessionId by other means, such as a request header,
     * generate a random sessionId.
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
 * Extract the `UserContext` from GrowthBook's own `UserContext`, which we
 * passed into `isOn` as `attributes`.
 */
export function extractUserContextFromGrowthbookUserContext(
  userContext: GrowthBookUserContext,
): NormalizedUserContext {
  /*
   * The values passed to Growthbook already should have been
   * `NormalizedUserContext`, but for type safety we run them through the
   * normalizer again to ensure we have all the required properties and
   * fallbacks in place.
   */
  return normalizeUserContext({
    did: userContext.attributes?.did,
    deviceId: userContext.attributes?.deviceId,
    sessionId: userContext.attributes?.sessionId,
  })
}

/**
 * Convert the `UserContext` into the `TrackingMetadata` format that we
 * use for our analytics events. This ensures that we have the same user
 * properties as we do for events from our client app.
 */
export function parsedUserContextToTrackingMetadata(
  userContext: NormalizedUserContext,
): TrackingMetadata {
  return {
    base: {
      deviceId: userContext.deviceId,
      sessionId: userContext.sessionId,
    },
    session: {
      did: userContext.did ?? undefined,
    },
  }
}
