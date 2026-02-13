import type express from 'express'

export const ANALYTICS_HEADER_STABLE_ID = 'X-Bsky-Stable-Id'
export const ANALYTICS_HEADER_SESSION_ID = 'X-Bsky-Session-Id'

export type AnalyticsHeaders = {
  stableId: string | undefined
  sessionId: string | undefined
}

export const extractAnalyticsHeaders = (
  req: express.Request,
): AnalyticsHeaders => {
  return {
    stableId: req.header(ANALYTICS_HEADER_STABLE_ID),
    sessionId: req.header(ANALYTICS_HEADER_SESSION_ID),
  }
}
