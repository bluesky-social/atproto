import { AppBskyActorDefs } from './client'
import { ModerationPrefs } from './moderation/types'

export type UnknownServiceType = string & NonNullable<unknown>
export type AtprotoServiceType = 'atproto_labeler' | UnknownServiceType
export function isAtprotoServiceType<T extends string>(
  input: T,
): input is T & AtprotoServiceType {
  return !input.includes(' ') && !input.includes('#')
}

// @TODO use tools from @atproto/did
export type Did = `did:${string}:${string}`
export function isDid<T extends string>(input: T): input is T & Did {
  if (!input.startsWith('did:')) return false
  if (input.length < 8) return false
  if (input.length > 2048) return false
  const msidx = input.indexOf(':', 4)
  return msidx > 4 && msidx < input.length - 1
}

export function assertDid(input: string): asserts input is Did {
  if (!isDid(input)) throw new TypeError(`Invalid DID: ${input}`)
}

export function asDid<T extends string>(input: T) {
  assertDid(input)
  return input
}

export type AtprotoProxy = `${Did}#${AtprotoServiceType}`
export function isAtprotoProxy(input: string): input is AtprotoProxy {
  const { length, [0]: did, [1]: service } = input.split('#')
  return length === 2 && isDid(did) && isAtprotoServiceType(service)
}

export function assertAtprotoProxy(
  input: string,
): asserts input is AtprotoProxy {
  if (!isAtprotoProxy(input)) {
    throw new TypeError(
      `Invalid DID reference: ${input} (must be of the form did:example:alice#service)`,
    )
  }
}

export function asAtprotoProxy<T extends string>(input: T) {
  assertAtprotoProxy(input)
  return input
}

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
  allowTakendown?: boolean
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
  postInteractionSettings: AppBskyActorDefs.PostInteractionSettingsPref
  verificationPrefs: AppBskyActorDefs.VerificationPrefs
}
