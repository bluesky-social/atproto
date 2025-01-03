/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, is$typed } from '../../../../util'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import * as AppBskyGraphDefs from '../graph/defs'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

const id = 'app.bsky.actor.defs'

export interface ProfileViewBasic {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  associated?: ProfileAssociated
  viewer?: ViewerState
  labels?: ComAtprotoLabelDefs.Label[]
  createdAt?: string
  [k: string]: unknown
}

export function isProfileViewBasic(v: unknown): v is ProfileViewBasic & {
  $type: $Type<'app.bsky.actor.defs', 'profileViewBasic'>
} {
  return is$typed(v, id, 'profileViewBasic')
}

export function validateProfileViewBasic(v: unknown) {
  return lexicons.validate(
    `${id}#profileViewBasic`,
    v,
  ) as ValidationResult<ProfileViewBasic>
}

export interface ProfileView {
  did: string
  handle: string
  displayName?: string
  description?: string
  avatar?: string
  associated?: ProfileAssociated
  indexedAt?: string
  createdAt?: string
  viewer?: ViewerState
  labels?: ComAtprotoLabelDefs.Label[]
  [k: string]: unknown
}

export function isProfileView(
  v: unknown,
): v is ProfileView & { $type: $Type<'app.bsky.actor.defs', 'profileView'> } {
  return is$typed(v, id, 'profileView')
}

export function validateProfileView(v: unknown) {
  return lexicons.validate(
    `${id}#profileView`,
    v,
  ) as ValidationResult<ProfileView>
}

export interface ProfileViewDetailed {
  did: string
  handle: string
  displayName?: string
  description?: string
  avatar?: string
  banner?: string
  followersCount?: number
  followsCount?: number
  postsCount?: number
  associated?: ProfileAssociated
  joinedViaStarterPack?: AppBskyGraphDefs.StarterPackViewBasic
  indexedAt?: string
  createdAt?: string
  viewer?: ViewerState
  labels?: ComAtprotoLabelDefs.Label[]
  pinnedPost?: ComAtprotoRepoStrongRef.Main
  [k: string]: unknown
}

export function isProfileViewDetailed(v: unknown): v is ProfileViewDetailed & {
  $type: $Type<'app.bsky.actor.defs', 'profileViewDetailed'>
} {
  return is$typed(v, id, 'profileViewDetailed')
}

export function validateProfileViewDetailed(v: unknown) {
  return lexicons.validate(
    `${id}#profileViewDetailed`,
    v,
  ) as ValidationResult<ProfileViewDetailed>
}

export interface ProfileAssociated {
  lists?: number
  feedgens?: number
  starterPacks?: number
  labeler?: boolean
  chat?: ProfileAssociatedChat
  [k: string]: unknown
}

export function isProfileAssociated(v: unknown): v is ProfileAssociated & {
  $type: $Type<'app.bsky.actor.defs', 'profileAssociated'>
} {
  return is$typed(v, id, 'profileAssociated')
}

export function validateProfileAssociated(v: unknown) {
  return lexicons.validate(
    `${id}#profileAssociated`,
    v,
  ) as ValidationResult<ProfileAssociated>
}

export interface ProfileAssociatedChat {
  allowIncoming: 'all' | 'none' | 'following' | (string & {})
  [k: string]: unknown
}

export function isProfileAssociatedChat(
  v: unknown,
): v is ProfileAssociatedChat & {
  $type: $Type<'app.bsky.actor.defs', 'profileAssociatedChat'>
} {
  return is$typed(v, id, 'profileAssociatedChat')
}

export function validateProfileAssociatedChat(v: unknown) {
  return lexicons.validate(
    `${id}#profileAssociatedChat`,
    v,
  ) as ValidationResult<ProfileAssociatedChat>
}

/** Metadata about the requesting account's relationship with the subject account. Only has meaningful content for authed requests. */
export interface ViewerState {
  muted?: boolean
  mutedByList?: AppBskyGraphDefs.ListViewBasic
  blockedBy?: boolean
  blocking?: string
  blockingByList?: AppBskyGraphDefs.ListViewBasic
  following?: string
  followedBy?: string
  knownFollowers?: KnownFollowers
  [k: string]: unknown
}

export function isViewerState(
  v: unknown,
): v is ViewerState & { $type: $Type<'app.bsky.actor.defs', 'viewerState'> } {
  return is$typed(v, id, 'viewerState')
}

export function validateViewerState(v: unknown) {
  return lexicons.validate(
    `${id}#viewerState`,
    v,
  ) as ValidationResult<ViewerState>
}

/** The subject's followers whom you also follow */
export interface KnownFollowers {
  count: number
  followers: ProfileViewBasic[]
  [k: string]: unknown
}

export function isKnownFollowers(v: unknown): v is KnownFollowers & {
  $type: $Type<'app.bsky.actor.defs', 'knownFollowers'>
} {
  return is$typed(v, id, 'knownFollowers')
}

export function validateKnownFollowers(v: unknown) {
  return lexicons.validate(
    `${id}#knownFollowers`,
    v,
  ) as ValidationResult<KnownFollowers>
}

export type Preferences = (
  | AdultContentPref
  | ContentLabelPref
  | SavedFeedsPref
  | SavedFeedsPrefV2
  | PersonalDetailsPref
  | FeedViewPref
  | ThreadViewPref
  | InterestsPref
  | MutedWordsPref
  | HiddenPostsPref
  | BskyAppStatePref
  | LabelersPref
  | { $type: string; [k: string]: unknown }
)[]

export interface AdultContentPref {
  enabled: boolean
  [k: string]: unknown
}

export function isAdultContentPref(v: unknown): v is AdultContentPref & {
  $type: $Type<'app.bsky.actor.defs', 'adultContentPref'>
} {
  return is$typed(v, id, 'adultContentPref')
}

export function validateAdultContentPref(v: unknown) {
  return lexicons.validate(
    `${id}#adultContentPref`,
    v,
  ) as ValidationResult<AdultContentPref>
}

export interface ContentLabelPref {
  /** Which labeler does this preference apply to? If undefined, applies globally. */
  labelerDid?: string
  label: string
  visibility: 'ignore' | 'show' | 'warn' | 'hide' | (string & {})
  [k: string]: unknown
}

export function isContentLabelPref(v: unknown): v is ContentLabelPref & {
  $type: $Type<'app.bsky.actor.defs', 'contentLabelPref'>
} {
  return is$typed(v, id, 'contentLabelPref')
}

export function validateContentLabelPref(v: unknown) {
  return lexicons.validate(
    `${id}#contentLabelPref`,
    v,
  ) as ValidationResult<ContentLabelPref>
}

export interface SavedFeed {
  id: string
  type: 'feed' | 'list' | 'timeline' | (string & {})
  value: string
  pinned: boolean
  [k: string]: unknown
}

export function isSavedFeed(
  v: unknown,
): v is SavedFeed & { $type: $Type<'app.bsky.actor.defs', 'savedFeed'> } {
  return is$typed(v, id, 'savedFeed')
}

export function validateSavedFeed(v: unknown) {
  return lexicons.validate(`${id}#savedFeed`, v) as ValidationResult<SavedFeed>
}

export interface SavedFeedsPrefV2 {
  items: SavedFeed[]
  [k: string]: unknown
}

export function isSavedFeedsPrefV2(v: unknown): v is SavedFeedsPrefV2 & {
  $type: $Type<'app.bsky.actor.defs', 'savedFeedsPrefV2'>
} {
  return is$typed(v, id, 'savedFeedsPrefV2')
}

export function validateSavedFeedsPrefV2(v: unknown) {
  return lexicons.validate(
    `${id}#savedFeedsPrefV2`,
    v,
  ) as ValidationResult<SavedFeedsPrefV2>
}

export interface SavedFeedsPref {
  pinned: string[]
  saved: string[]
  timelineIndex?: number
  [k: string]: unknown
}

export function isSavedFeedsPref(v: unknown): v is SavedFeedsPref & {
  $type: $Type<'app.bsky.actor.defs', 'savedFeedsPref'>
} {
  return is$typed(v, id, 'savedFeedsPref')
}

export function validateSavedFeedsPref(v: unknown) {
  return lexicons.validate(
    `${id}#savedFeedsPref`,
    v,
  ) as ValidationResult<SavedFeedsPref>
}

export interface PersonalDetailsPref {
  /** The birth date of account owner. */
  birthDate?: string
  [k: string]: unknown
}

export function isPersonalDetailsPref(v: unknown): v is PersonalDetailsPref & {
  $type: $Type<'app.bsky.actor.defs', 'personalDetailsPref'>
} {
  return is$typed(v, id, 'personalDetailsPref')
}

export function validatePersonalDetailsPref(v: unknown) {
  return lexicons.validate(
    `${id}#personalDetailsPref`,
    v,
  ) as ValidationResult<PersonalDetailsPref>
}

export interface FeedViewPref {
  /** The URI of the feed, or an identifier which describes the feed. */
  feed: string
  /** Hide replies in the feed. */
  hideReplies?: boolean
  /** Hide replies in the feed if they are not by followed users. */
  hideRepliesByUnfollowed: boolean
  /** Hide replies in the feed if they do not have this number of likes. */
  hideRepliesByLikeCount?: number
  /** Hide reposts in the feed. */
  hideReposts?: boolean
  /** Hide quote posts in the feed. */
  hideQuotePosts?: boolean
  [k: string]: unknown
}

export function isFeedViewPref(
  v: unknown,
): v is FeedViewPref & { $type: $Type<'app.bsky.actor.defs', 'feedViewPref'> } {
  return is$typed(v, id, 'feedViewPref')
}

export function validateFeedViewPref(v: unknown) {
  return lexicons.validate(
    `${id}#feedViewPref`,
    v,
  ) as ValidationResult<FeedViewPref>
}

export interface ThreadViewPref {
  /** Sorting mode for threads. */
  sort?:
    | 'oldest'
    | 'newest'
    | 'most-likes'
    | 'random'
    | 'hotness'
    | (string & {})
  /** Show followed users at the top of all replies. */
  prioritizeFollowedUsers?: boolean
  [k: string]: unknown
}

export function isThreadViewPref(v: unknown): v is ThreadViewPref & {
  $type: $Type<'app.bsky.actor.defs', 'threadViewPref'>
} {
  return is$typed(v, id, 'threadViewPref')
}

export function validateThreadViewPref(v: unknown) {
  return lexicons.validate(
    `${id}#threadViewPref`,
    v,
  ) as ValidationResult<ThreadViewPref>
}

export interface InterestsPref {
  /** A list of tags which describe the account owner's interests gathered during onboarding. */
  tags: string[]
  [k: string]: unknown
}

export function isInterestsPref(v: unknown): v is InterestsPref & {
  $type: $Type<'app.bsky.actor.defs', 'interestsPref'>
} {
  return is$typed(v, id, 'interestsPref')
}

export function validateInterestsPref(v: unknown) {
  return lexicons.validate(
    `${id}#interestsPref`,
    v,
  ) as ValidationResult<InterestsPref>
}

export type MutedWordTarget = 'content' | 'tag' | (string & {})

/** A word that the account owner has muted. */
export interface MutedWord {
  id?: string
  /** The muted word itself. */
  value: string
  /** The intended targets of the muted word. */
  targets: MutedWordTarget[]
  /** Groups of users to apply the muted word to. If undefined, applies to all users. */
  actorTarget: 'all' | 'exclude-following' | (string & {})
  /** The date and time at which the muted word will expire and no longer be applied. */
  expiresAt?: string
  [k: string]: unknown
}

export function isMutedWord(
  v: unknown,
): v is MutedWord & { $type: $Type<'app.bsky.actor.defs', 'mutedWord'> } {
  return is$typed(v, id, 'mutedWord')
}

export function validateMutedWord(v: unknown) {
  return lexicons.validate(`${id}#mutedWord`, v) as ValidationResult<MutedWord>
}

export interface MutedWordsPref {
  /** A list of words the account owner has muted. */
  items: MutedWord[]
  [k: string]: unknown
}

export function isMutedWordsPref(v: unknown): v is MutedWordsPref & {
  $type: $Type<'app.bsky.actor.defs', 'mutedWordsPref'>
} {
  return is$typed(v, id, 'mutedWordsPref')
}

export function validateMutedWordsPref(v: unknown) {
  return lexicons.validate(
    `${id}#mutedWordsPref`,
    v,
  ) as ValidationResult<MutedWordsPref>
}

export interface HiddenPostsPref {
  /** A list of URIs of posts the account owner has hidden. */
  items: string[]
  [k: string]: unknown
}

export function isHiddenPostsPref(v: unknown): v is HiddenPostsPref & {
  $type: $Type<'app.bsky.actor.defs', 'hiddenPostsPref'>
} {
  return is$typed(v, id, 'hiddenPostsPref')
}

export function validateHiddenPostsPref(v: unknown) {
  return lexicons.validate(
    `${id}#hiddenPostsPref`,
    v,
  ) as ValidationResult<HiddenPostsPref>
}

export interface LabelersPref {
  labelers: LabelerPrefItem[]
  [k: string]: unknown
}

export function isLabelersPref(
  v: unknown,
): v is LabelersPref & { $type: $Type<'app.bsky.actor.defs', 'labelersPref'> } {
  return is$typed(v, id, 'labelersPref')
}

export function validateLabelersPref(v: unknown) {
  return lexicons.validate(
    `${id}#labelersPref`,
    v,
  ) as ValidationResult<LabelersPref>
}

export interface LabelerPrefItem {
  did: string
  [k: string]: unknown
}

export function isLabelerPrefItem(v: unknown): v is LabelerPrefItem & {
  $type: $Type<'app.bsky.actor.defs', 'labelerPrefItem'>
} {
  return is$typed(v, id, 'labelerPrefItem')
}

export function validateLabelerPrefItem(v: unknown) {
  return lexicons.validate(
    `${id}#labelerPrefItem`,
    v,
  ) as ValidationResult<LabelerPrefItem>
}

/** A grab bag of state that's specific to the bsky.app program. Third-party apps shouldn't use this. */
export interface BskyAppStatePref {
  activeProgressGuide?: BskyAppProgressGuide
  /** An array of tokens which identify nudges (modals, popups, tours, highlight dots) that should be shown to the user. */
  queuedNudges?: string[]
  /** Storage for NUXs the user has encountered. */
  nuxs?: Nux[]
  [k: string]: unknown
}

export function isBskyAppStatePref(v: unknown): v is BskyAppStatePref & {
  $type: $Type<'app.bsky.actor.defs', 'bskyAppStatePref'>
} {
  return is$typed(v, id, 'bskyAppStatePref')
}

export function validateBskyAppStatePref(v: unknown) {
  return lexicons.validate(
    `${id}#bskyAppStatePref`,
    v,
  ) as ValidationResult<BskyAppStatePref>
}

/** If set, an active progress guide. Once completed, can be set to undefined. Should have unspecced fields tracking progress. */
export interface BskyAppProgressGuide {
  guide: string
  [k: string]: unknown
}

export function isBskyAppProgressGuide(
  v: unknown,
): v is BskyAppProgressGuide & {
  $type: $Type<'app.bsky.actor.defs', 'bskyAppProgressGuide'>
} {
  return is$typed(v, id, 'bskyAppProgressGuide')
}

export function validateBskyAppProgressGuide(v: unknown) {
  return lexicons.validate(
    `${id}#bskyAppProgressGuide`,
    v,
  ) as ValidationResult<BskyAppProgressGuide>
}

/** A new user experiences (NUX) storage object */
export interface Nux {
  id: string
  completed: boolean
  /** Arbitrary data for the NUX. The structure is defined by the NUX itself. Limited to 300 characters. */
  data?: string
  /** The date and time at which the NUX will expire and should be considered completed. */
  expiresAt?: string
  [k: string]: unknown
}

export function isNux(
  v: unknown,
): v is Nux & { $type: $Type<'app.bsky.actor.defs', 'nux'> } {
  return is$typed(v, id, 'nux')
}

export function validateNux(v: unknown) {
  return lexicons.validate(`${id}#nux`, v) as ValidationResult<Nux>
}
