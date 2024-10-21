import { AppBskyActorDefs } from './client'
import { ModerationPrefs } from './moderation/types'

/**
 * Supported proxy targets
 */
type UnknownServiceType = string & NonNullable<unknown>
export type AtprotoServiceType = 'atproto_labeler' | UnknownServiceType

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
  active: boolean
  status?: string
}

/**
 * Handler signature passed to AtpAgent to store session data
 */
export type AtpPersistSessionHandler = (
  evt: AtpSessionEvent,
  session: AtpSessionData | undefined,
) => void | Promise<void>

/**
 * AtpAgent login() opts
 */
export interface AtpAgentLoginOpts {
  identifier: string
  password: string
  authFactorToken?: string | undefined
}

/**
 * AtpAgent global config opts
 */
export interface AtpAgentGlobalOpts {
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
  bskyAppState: {
    queuedNudges: string[]
    activeProgressGuide: AppBskyActorDefs.BskyAppProgressGuide | undefined
    nuxs: AppBskyActorDefs.Nux[]
  }
}
