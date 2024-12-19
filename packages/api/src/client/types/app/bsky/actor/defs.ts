/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import type * as AppBskyGraphDefs from '../graph/defs'
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'app.bsky.actor.defs'

export interface ProfileViewBasic {
  $type?: $Type<'app.bsky.actor.defs', 'profileViewBasic'>
  did: string
  handle: string
  displayName?: string
  avatar?: string
  associated?: ProfileAssociated
  viewer?: ViewerState
  labels?: ComAtprotoLabelDefs.Label[]
  createdAt?: string
}

const hashProfileViewBasic = 'profileViewBasic'

export function isProfileViewBasic<V>(v: V) {
  return is$typed(v, id, hashProfileViewBasic)
}

export function validateProfileViewBasic<V>(v: V) {
  return validate<ProfileViewBasic & V>(v, id, hashProfileViewBasic)
}

export function isValidProfileViewBasic<V>(v: V) {
  return isValid<ProfileViewBasic>(v, id, hashProfileViewBasic)
}

export interface ProfileView {
  $type?: $Type<'app.bsky.actor.defs', 'profileView'>
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
}

const hashProfileView = 'profileView'

export function isProfileView<V>(v: V) {
  return is$typed(v, id, hashProfileView)
}

export function validateProfileView<V>(v: V) {
  return validate<ProfileView & V>(v, id, hashProfileView)
}

export function isValidProfileView<V>(v: V) {
  return isValid<ProfileView>(v, id, hashProfileView)
}

export interface ProfileViewDetailed {
  $type?: $Type<'app.bsky.actor.defs', 'profileViewDetailed'>
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
}

const hashProfileViewDetailed = 'profileViewDetailed'

export function isProfileViewDetailed<V>(v: V) {
  return is$typed(v, id, hashProfileViewDetailed)
}

export function validateProfileViewDetailed<V>(v: V) {
  return validate<ProfileViewDetailed & V>(v, id, hashProfileViewDetailed)
}

export function isValidProfileViewDetailed<V>(v: V) {
  return isValid<ProfileViewDetailed>(v, id, hashProfileViewDetailed)
}

export interface ProfileAssociated {
  $type?: $Type<'app.bsky.actor.defs', 'profileAssociated'>
  lists?: number
  feedgens?: number
  starterPacks?: number
  labeler?: boolean
  chat?: ProfileAssociatedChat
}

const hashProfileAssociated = 'profileAssociated'

export function isProfileAssociated<V>(v: V) {
  return is$typed(v, id, hashProfileAssociated)
}

export function validateProfileAssociated<V>(v: V) {
  return validate<ProfileAssociated & V>(v, id, hashProfileAssociated)
}

export function isValidProfileAssociated<V>(v: V) {
  return isValid<ProfileAssociated>(v, id, hashProfileAssociated)
}

export interface ProfileAssociatedChat {
  $type?: $Type<'app.bsky.actor.defs', 'profileAssociatedChat'>
  allowIncoming: 'all' | 'none' | 'following' | (string & {})
}

const hashProfileAssociatedChat = 'profileAssociatedChat'

export function isProfileAssociatedChat<V>(v: V) {
  return is$typed(v, id, hashProfileAssociatedChat)
}

export function validateProfileAssociatedChat<V>(v: V) {
  return validate<ProfileAssociatedChat & V>(v, id, hashProfileAssociatedChat)
}

export function isValidProfileAssociatedChat<V>(v: V) {
  return isValid<ProfileAssociatedChat>(v, id, hashProfileAssociatedChat)
}

/** Metadata about the requesting account's relationship with the subject account. Only has meaningful content for authed requests. */
export interface ViewerState {
  $type?: $Type<'app.bsky.actor.defs', 'viewerState'>
  muted?: boolean
  mutedByList?: AppBskyGraphDefs.ListViewBasic
  blockedBy?: boolean
  blocking?: string
  blockingByList?: AppBskyGraphDefs.ListViewBasic
  following?: string
  followedBy?: string
  knownFollowers?: KnownFollowers
}

const hashViewerState = 'viewerState'

export function isViewerState<V>(v: V) {
  return is$typed(v, id, hashViewerState)
}

export function validateViewerState<V>(v: V) {
  return validate<ViewerState & V>(v, id, hashViewerState)
}

export function isValidViewerState<V>(v: V) {
  return isValid<ViewerState>(v, id, hashViewerState)
}

/** The subject's followers whom you also follow */
export interface KnownFollowers {
  $type?: $Type<'app.bsky.actor.defs', 'knownFollowers'>
  count: number
  followers: ProfileViewBasic[]
}

const hashKnownFollowers = 'knownFollowers'

export function isKnownFollowers<V>(v: V) {
  return is$typed(v, id, hashKnownFollowers)
}

export function validateKnownFollowers<V>(v: V) {
  return validate<KnownFollowers & V>(v, id, hashKnownFollowers)
}

export function isValidKnownFollowers<V>(v: V) {
  return isValid<KnownFollowers>(v, id, hashKnownFollowers)
}

export type Preferences = (
  | $Typed<AdultContentPref>
  | $Typed<ContentLabelPref>
  | $Typed<SavedFeedsPref>
  | $Typed<SavedFeedsPrefV2>
  | $Typed<PersonalDetailsPref>
  | $Typed<FeedViewPref>
  | $Typed<ThreadViewPref>
  | $Typed<InterestsPref>
  | $Typed<MutedWordsPref>
  | $Typed<HiddenPostsPref>
  | $Typed<BskyAppStatePref>
  | $Typed<LabelersPref>
  | { $type: string }
)[]

export interface AdultContentPref {
  $type?: $Type<'app.bsky.actor.defs', 'adultContentPref'>
  enabled: boolean
}

const hashAdultContentPref = 'adultContentPref'

export function isAdultContentPref<V>(v: V) {
  return is$typed(v, id, hashAdultContentPref)
}

export function validateAdultContentPref<V>(v: V) {
  return validate<AdultContentPref & V>(v, id, hashAdultContentPref)
}

export function isValidAdultContentPref<V>(v: V) {
  return isValid<AdultContentPref>(v, id, hashAdultContentPref)
}

export interface ContentLabelPref {
  $type?: $Type<'app.bsky.actor.defs', 'contentLabelPref'>
  /** Which labeler does this preference apply to? If undefined, applies globally. */
  labelerDid?: string
  label: string
  visibility: 'ignore' | 'show' | 'warn' | 'hide' | (string & {})
}

const hashContentLabelPref = 'contentLabelPref'

export function isContentLabelPref<V>(v: V) {
  return is$typed(v, id, hashContentLabelPref)
}

export function validateContentLabelPref<V>(v: V) {
  return validate<ContentLabelPref & V>(v, id, hashContentLabelPref)
}

export function isValidContentLabelPref<V>(v: V) {
  return isValid<ContentLabelPref>(v, id, hashContentLabelPref)
}

export interface SavedFeed {
  $type?: $Type<'app.bsky.actor.defs', 'savedFeed'>
  id: string
  type: 'feed' | 'list' | 'timeline' | (string & {})
  value: string
  pinned: boolean
}

const hashSavedFeed = 'savedFeed'

export function isSavedFeed<V>(v: V) {
  return is$typed(v, id, hashSavedFeed)
}

export function validateSavedFeed<V>(v: V) {
  return validate<SavedFeed & V>(v, id, hashSavedFeed)
}

export function isValidSavedFeed<V>(v: V) {
  return isValid<SavedFeed>(v, id, hashSavedFeed)
}

export interface SavedFeedsPrefV2 {
  $type?: $Type<'app.bsky.actor.defs', 'savedFeedsPrefV2'>
  items: SavedFeed[]
}

const hashSavedFeedsPrefV2 = 'savedFeedsPrefV2'

export function isSavedFeedsPrefV2<V>(v: V) {
  return is$typed(v, id, hashSavedFeedsPrefV2)
}

export function validateSavedFeedsPrefV2<V>(v: V) {
  return validate<SavedFeedsPrefV2 & V>(v, id, hashSavedFeedsPrefV2)
}

export function isValidSavedFeedsPrefV2<V>(v: V) {
  return isValid<SavedFeedsPrefV2>(v, id, hashSavedFeedsPrefV2)
}

export interface SavedFeedsPref {
  $type?: $Type<'app.bsky.actor.defs', 'savedFeedsPref'>
  pinned: string[]
  saved: string[]
  timelineIndex?: number
}

const hashSavedFeedsPref = 'savedFeedsPref'

export function isSavedFeedsPref<V>(v: V) {
  return is$typed(v, id, hashSavedFeedsPref)
}

export function validateSavedFeedsPref<V>(v: V) {
  return validate<SavedFeedsPref & V>(v, id, hashSavedFeedsPref)
}

export function isValidSavedFeedsPref<V>(v: V) {
  return isValid<SavedFeedsPref>(v, id, hashSavedFeedsPref)
}

export interface PersonalDetailsPref {
  $type?: $Type<'app.bsky.actor.defs', 'personalDetailsPref'>
  /** The birth date of account owner. */
  birthDate?: string
}

const hashPersonalDetailsPref = 'personalDetailsPref'

export function isPersonalDetailsPref<V>(v: V) {
  return is$typed(v, id, hashPersonalDetailsPref)
}

export function validatePersonalDetailsPref<V>(v: V) {
  return validate<PersonalDetailsPref & V>(v, id, hashPersonalDetailsPref)
}

export function isValidPersonalDetailsPref<V>(v: V) {
  return isValid<PersonalDetailsPref>(v, id, hashPersonalDetailsPref)
}

export interface FeedViewPref {
  $type?: $Type<'app.bsky.actor.defs', 'feedViewPref'>
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
}

const hashFeedViewPref = 'feedViewPref'

export function isFeedViewPref<V>(v: V) {
  return is$typed(v, id, hashFeedViewPref)
}

export function validateFeedViewPref<V>(v: V) {
  return validate<FeedViewPref & V>(v, id, hashFeedViewPref)
}

export function isValidFeedViewPref<V>(v: V) {
  return isValid<FeedViewPref>(v, id, hashFeedViewPref)
}

export interface ThreadViewPref {
  $type?: $Type<'app.bsky.actor.defs', 'threadViewPref'>
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
}

const hashThreadViewPref = 'threadViewPref'

export function isThreadViewPref<V>(v: V) {
  return is$typed(v, id, hashThreadViewPref)
}

export function validateThreadViewPref<V>(v: V) {
  return validate<ThreadViewPref & V>(v, id, hashThreadViewPref)
}

export function isValidThreadViewPref<V>(v: V) {
  return isValid<ThreadViewPref>(v, id, hashThreadViewPref)
}

export interface InterestsPref {
  $type?: $Type<'app.bsky.actor.defs', 'interestsPref'>
  /** A list of tags which describe the account owner's interests gathered during onboarding. */
  tags: string[]
}

const hashInterestsPref = 'interestsPref'

export function isInterestsPref<V>(v: V) {
  return is$typed(v, id, hashInterestsPref)
}

export function validateInterestsPref<V>(v: V) {
  return validate<InterestsPref & V>(v, id, hashInterestsPref)
}

export function isValidInterestsPref<V>(v: V) {
  return isValid<InterestsPref>(v, id, hashInterestsPref)
}

export type MutedWordTarget = 'content' | 'tag' | (string & {})

/** A word that the account owner has muted. */
export interface MutedWord {
  $type?: $Type<'app.bsky.actor.defs', 'mutedWord'>
  id?: string
  /** The muted word itself. */
  value: string
  /** The intended targets of the muted word. */
  targets: MutedWordTarget[]
  /** Groups of users to apply the muted word to. If undefined, applies to all users. */
  actorTarget: 'all' | 'exclude-following' | (string & {})
  /** The date and time at which the muted word will expire and no longer be applied. */
  expiresAt?: string
}

const hashMutedWord = 'mutedWord'

export function isMutedWord<V>(v: V) {
  return is$typed(v, id, hashMutedWord)
}

export function validateMutedWord<V>(v: V) {
  return validate<MutedWord & V>(v, id, hashMutedWord)
}

export function isValidMutedWord<V>(v: V) {
  return isValid<MutedWord>(v, id, hashMutedWord)
}

export interface MutedWordsPref {
  $type?: $Type<'app.bsky.actor.defs', 'mutedWordsPref'>
  /** A list of words the account owner has muted. */
  items: MutedWord[]
}

const hashMutedWordsPref = 'mutedWordsPref'

export function isMutedWordsPref<V>(v: V) {
  return is$typed(v, id, hashMutedWordsPref)
}

export function validateMutedWordsPref<V>(v: V) {
  return validate<MutedWordsPref & V>(v, id, hashMutedWordsPref)
}

export function isValidMutedWordsPref<V>(v: V) {
  return isValid<MutedWordsPref>(v, id, hashMutedWordsPref)
}

export interface HiddenPostsPref {
  $type?: $Type<'app.bsky.actor.defs', 'hiddenPostsPref'>
  /** A list of URIs of posts the account owner has hidden. */
  items: string[]
}

const hashHiddenPostsPref = 'hiddenPostsPref'

export function isHiddenPostsPref<V>(v: V) {
  return is$typed(v, id, hashHiddenPostsPref)
}

export function validateHiddenPostsPref<V>(v: V) {
  return validate<HiddenPostsPref & V>(v, id, hashHiddenPostsPref)
}

export function isValidHiddenPostsPref<V>(v: V) {
  return isValid<HiddenPostsPref>(v, id, hashHiddenPostsPref)
}

export interface LabelersPref {
  $type?: $Type<'app.bsky.actor.defs', 'labelersPref'>
  labelers: LabelerPrefItem[]
}

const hashLabelersPref = 'labelersPref'

export function isLabelersPref<V>(v: V) {
  return is$typed(v, id, hashLabelersPref)
}

export function validateLabelersPref<V>(v: V) {
  return validate<LabelersPref & V>(v, id, hashLabelersPref)
}

export function isValidLabelersPref<V>(v: V) {
  return isValid<LabelersPref>(v, id, hashLabelersPref)
}

export interface LabelerPrefItem {
  $type?: $Type<'app.bsky.actor.defs', 'labelerPrefItem'>
  did: string
}

const hashLabelerPrefItem = 'labelerPrefItem'

export function isLabelerPrefItem<V>(v: V) {
  return is$typed(v, id, hashLabelerPrefItem)
}

export function validateLabelerPrefItem<V>(v: V) {
  return validate<LabelerPrefItem & V>(v, id, hashLabelerPrefItem)
}

export function isValidLabelerPrefItem<V>(v: V) {
  return isValid<LabelerPrefItem>(v, id, hashLabelerPrefItem)
}

/** A grab bag of state that's specific to the bsky.app program. Third-party apps shouldn't use this. */
export interface BskyAppStatePref {
  $type?: $Type<'app.bsky.actor.defs', 'bskyAppStatePref'>
  activeProgressGuide?: BskyAppProgressGuide
  /** An array of tokens which identify nudges (modals, popups, tours, highlight dots) that should be shown to the user. */
  queuedNudges?: string[]
  /** Storage for NUXs the user has encountered. */
  nuxs?: Nux[]
}

const hashBskyAppStatePref = 'bskyAppStatePref'

export function isBskyAppStatePref<V>(v: V) {
  return is$typed(v, id, hashBskyAppStatePref)
}

export function validateBskyAppStatePref<V>(v: V) {
  return validate<BskyAppStatePref & V>(v, id, hashBskyAppStatePref)
}

export function isValidBskyAppStatePref<V>(v: V) {
  return isValid<BskyAppStatePref>(v, id, hashBskyAppStatePref)
}

/** If set, an active progress guide. Once completed, can be set to undefined. Should have unspecced fields tracking progress. */
export interface BskyAppProgressGuide {
  $type?: $Type<'app.bsky.actor.defs', 'bskyAppProgressGuide'>
  guide: string
}

const hashBskyAppProgressGuide = 'bskyAppProgressGuide'

export function isBskyAppProgressGuide<V>(v: V) {
  return is$typed(v, id, hashBskyAppProgressGuide)
}

export function validateBskyAppProgressGuide<V>(v: V) {
  return validate<BskyAppProgressGuide & V>(v, id, hashBskyAppProgressGuide)
}

export function isValidBskyAppProgressGuide<V>(v: V) {
  return isValid<BskyAppProgressGuide>(v, id, hashBskyAppProgressGuide)
}

/** A new user experiences (NUX) storage object */
export interface Nux {
  $type?: $Type<'app.bsky.actor.defs', 'nux'>
  id: string
  completed: boolean
  /** Arbitrary data for the NUX. The structure is defined by the NUX itself. Limited to 300 characters. */
  data?: string
  /** The date and time at which the NUX will expire and should be considered completed. */
  expiresAt?: string
}

const hashNux = 'nux'

export function isNux<V>(v: V) {
  return is$typed(v, id, hashNux)
}

export function validateNux<V>(v: V) {
  return validate<Nux & V>(v, id, hashNux)
}

export function isValidNux<V>(v: V) {
  return isValid<Nux>(v, id, hashNux)
}
