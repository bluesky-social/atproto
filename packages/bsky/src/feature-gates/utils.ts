import { type UserContext as GrowthBookUserContext } from '@growthbook/growthbook'
import { ParsedUserContext, RawUserContext } from './types'

const ANALYTICS_HEADER_DEVICE_ID = 'X-Bsky-Device-Id'
const ANALYTICS_HEADER_SESSION_ID = 'X-Bsky-Session-Id'

export function parseRawUserContext(
  userContext: RawUserContext,
): ParsedUserContext {
  return {
    did: userContext.viewer,
    deviceId: userContext.req.header(ANALYTICS_HEADER_DEVICE_ID),
    sessionId: userContext.req.header(ANALYTICS_HEADER_SESSION_ID),
  }
}

export function extractParsedUserContextFromGrowthBookUserContext(
  userContext: GrowthBookUserContext,
): ParsedUserContext {
  return {
    did: userContext.attributes?.did,
    deviceId: userContext.attributes?.deviceId,
    sessionId: userContext.attributes?.sessionId,
  }
}
