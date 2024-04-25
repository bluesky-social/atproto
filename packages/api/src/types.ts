import { AppBskyActorDefs } from './client'
import { ModerationPrefs } from './moderation/types'

/**
 * Supported proxy targets
 */
export type AtprotoServiceType = 'atproto_labeler'

/**
 * Used by the PersistSessionHandler to indicate what change occurred
 */
export type AtpSessionEvent =
  | 'create'
  | 'create-failed'
  | 'update'
  | 'expired'
  | 'network-error'

/**
 * Used by AtpAgent to store active sessions
 */
export interface AtpSessionData {
  refreshJwt: string
  accessJwt: string
  handle: string
  did: string
  email?: string
  emailConfirmed?: boolean
  emailAuthFactor?: boolean
}

/**
 * Handler signature passed to AtpAgent to store session data
 */
export type AtpPersistSessionHandler = (
  evt: AtpSessionEvent,
  session: AtpSessionData | undefined,
) => void | Promise<void>

/**
 * AtpAgent constructor() opts
 */
export interface AtpAgentOpts {
  service: string | URL
  persistSession?: AtpPersistSessionHandler
}

/**
 * AtpAgent login() opts
 */
export interface AtpAgentLoginOpts {
  identifier: string
  password: string
  authFactorToken?: string | undefined
}

/**
 * AtpAgent global fetch handler
 */
type AtpAgentFetchHeaders = Record<string, string>
export interface AtpAgentFetchHandlerResponse {
  status: number
  headers: Record<string, string>
  body: any
}
export type AtpAgentFetchHandler = (
  httpUri: string,
  httpMethod: string,
  httpHeaders: AtpAgentFetchHeaders,
  httpReqBody: any,
) => Promise<AtpAgentFetchHandlerResponse>

/**
 * AtpAgent global config opts
 */
export interface AtpAgentGlobalOpts {
  fetch?: AtpAgentFetchHandler
  appLabelers?: string[]
}

/**
 * Bluesky feed view preferences
 */

export interface BskyFeedViewPreference {
  hideReplies: boolean
  hideRepliesByUnfollowed: boolean
  hideRepliesByLikeCount: number
  hideReposts: boolean
  hideQuotePosts: boolean
  [key: string]: any
}

/**
 * Bluesky thread view preferences
 */
export interface BskyThreadViewPreference {
  sort: string
  prioritizeFollowedUsers: boolean
  [key: string]: any
}

/**
 * Bluesky interests preferences
 */
export interface BskyInterestsPreference {
  tags: string[]
  [key: string]: any
}

/**
 * Bluesky preferences
 */
export interface BskyPreferences {
  /**
   * @deprecated use `savedFeeds`
   */
  feeds: {
    saved?: string[]
    pinned?: string[]
  }
  savedFeeds: AppBskyActorDefs.SavedFeed[]
  feedViewPrefs: Record<string, BskyFeedViewPreference>
  threadViewPrefs: BskyThreadViewPreference
  moderationPrefs: ModerationPrefs
  birthDate: Date | undefined
  interests: BskyInterestsPreference
}
