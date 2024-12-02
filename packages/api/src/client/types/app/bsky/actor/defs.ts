/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import * as AppBskyGraphDefs from '../graph/defs'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

export const id = 'app.bsky.actor.defs'

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

export function isProfileViewBasic<V>(v: V) {
  return is$typed(v, id, 'profileViewBasic')
}

export function validateProfileViewBasic(v: unknown) {
  return lexicons.validate(
    `${id}#profileViewBasic`,
    v,
  ) as ValidationResult<ProfileViewBasic>
}

export function isValidProfileViewBasic<V>(
  v: V,
): v is V & $Typed<ProfileViewBasic> {
  return isProfileViewBasic(v) && validateProfileViewBasic(v).success
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

export function isProfileView<V>(v: V) {
  return is$typed(v, id, 'profileView')
}

export function validateProfileView(v: unknown) {
  return lexicons.validate(
    `${id}#profileView`,
    v,
  ) as ValidationResult<ProfileView>
}

export function isValidProfileView<V>(v: V): v is V & $Typed<ProfileView> {
  return isProfileView(v) && validateProfileView(v).success
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

export function isProfileViewDetailed<V>(v: V) {
  return is$typed(v, id, 'profileViewDetailed')
}

export function validateProfileViewDetailed(v: unknown) {
  return lexicons.validate(
    `${id}#profileViewDetailed`,
    v,
  ) as ValidationResult<ProfileViewDetailed>
}

export function isValidProfileViewDetailed<V>(
  v: V,
): v is V & $Typed<ProfileViewDetailed> {
  return isProfileViewDetailed(v) && validateProfileViewDetailed(v).success
}

export interface ProfileAssociated {
  $type?: $Type<'app.bsky.actor.defs', 'profileAssociated'>
  lists?: number
  feedgens?: number
  starterPacks?: number
  labeler?: boolean
  chat?: ProfileAssociatedChat
}

export function isProfileAssociated<V>(v: V) {
  return is$typed(v, id, 'profileAssociated')
}

export function validateProfileAssociated(v: unknown) {
  return lexicons.validate(
    `${id}#profileAssociated`,
    v,
  ) as ValidationResult<ProfileAssociated>
}

export function isValidProfileAssociated<V>(
  v: V,
): v is V & $Typed<ProfileAssociated> {
  return isProfileAssociated(v) && validateProfileAssociated(v).success
}

export interface ProfileAssociatedChat {
  $type?: $Type<'app.bsky.actor.defs', 'profileAssociatedChat'>
  allowIncoming: 'all' | 'none' | 'following' | (string & {})
}

export function isProfileAssociatedChat<V>(v: V) {
  return is$typed(v, id, 'profileAssociatedChat')
}

export function validateProfileAssociatedChat(v: unknown) {
  return lexicons.validate(
    `${id}#profileAssociatedChat`,
    v,
  ) as ValidationResult<ProfileAssociatedChat>
}

export function isValidProfileAssociatedChat<V>(
  v: V,
): v is V & $Typed<ProfileAssociatedChat> {
  return isProfileAssociatedChat(v) && validateProfileAssociatedChat(v).success
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

export function isViewerState<V>(v: V) {
  return is$typed(v, id, 'viewerState')
}

export function validateViewerState(v: unknown) {
  return lexicons.validate(
    `${id}#viewerState`,
    v,
  ) as ValidationResult<ViewerState>
}

export function isValidViewerState<V>(v: V): v is V & $Typed<ViewerState> {
  return isViewerState(v) && validateViewerState(v).success
}

/** The subject's followers whom you also follow */
export interface KnownFollowers {
  $type?: $Type<'app.bsky.actor.defs', 'knownFollowers'>
  count: number
  followers: ProfileViewBasic[]
}

export function isKnownFollowers<V>(v: V) {
  return is$typed(v, id, 'knownFollowers')
}

export function validateKnownFollowers(v: unknown) {
  return lexicons.validate(
    `${id}#knownFollowers`,
    v,
  ) as ValidationResult<KnownFollowers>
}

export function isValidKnownFollowers<V>(
  v: V,
): v is V & $Typed<KnownFollowers> {
  return isKnownFollowers(v) && validateKnownFollowers(v).success
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

export function isAdultContentPref<V>(v: V) {
  return is$typed(v, id, 'adultContentPref')
}

export function validateAdultContentPref(v: unknown) {
  return lexicons.validate(
    `${id}#adultContentPref`,
    v,
  ) as ValidationResult<AdultContentPref>
}

export function isValidAdultContentPref<V>(
  v: V,
): v is V & $Typed<AdultContentPref> {
  return isAdultContentPref(v) && validateAdultContentPref(v).success
}

export interface ContentLabelPref {
  $type?: $Type<'app.bsky.actor.defs', 'contentLabelPref'>
  /** Which labeler does this preference apply to? If undefined, applies globally. */
  labelerDid?: string
  label: string
  visibility: 'ignore' | 'show' | 'warn' | 'hide' | (string & {})
}

export function isContentLabelPref<V>(v: V) {
  return is$typed(v, id, 'contentLabelPref')
}

export function validateContentLabelPref(v: unknown) {
  return lexicons.validate(
    `${id}#contentLabelPref`,
    v,
  ) as ValidationResult<ContentLabelPref>
}

export function isValidContentLabelPref<V>(
  v: V,
): v is V & $Typed<ContentLabelPref> {
  return isContentLabelPref(v) && validateContentLabelPref(v).success
}

export interface SavedFeed {
  $type?: $Type<'app.bsky.actor.defs', 'savedFeed'>
  id: string
  type: 'feed' | 'list' | 'timeline' | (string & {})
  value: string
  pinned: boolean
}

export function isSavedFeed<V>(v: V) {
  return is$typed(v, id, 'savedFeed')
}

export function validateSavedFeed(v: unknown) {
  return lexicons.validate(`${id}#savedFeed`, v) as ValidationResult<SavedFeed>
}

export function isValidSavedFeed<V>(v: V): v is V & $Typed<SavedFeed> {
  return isSavedFeed(v) && validateSavedFeed(v).success
}

export interface SavedFeedsPrefV2 {
  $type?: $Type<'app.bsky.actor.defs', 'savedFeedsPrefV2'>
  items: SavedFeed[]
}

export function isSavedFeedsPrefV2<V>(v: V) {
  return is$typed(v, id, 'savedFeedsPrefV2')
}

export function validateSavedFeedsPrefV2(v: unknown) {
  return lexicons.validate(
    `${id}#savedFeedsPrefV2`,
    v,
  ) as ValidationResult<SavedFeedsPrefV2>
}

export function isValidSavedFeedsPrefV2<V>(
  v: V,
): v is V & $Typed<SavedFeedsPrefV2> {
  return isSavedFeedsPrefV2(v) && validateSavedFeedsPrefV2(v).success
}

export interface SavedFeedsPref {
  $type?: $Type<'app.bsky.actor.defs', 'savedFeedsPref'>
  pinned: string[]
  saved: string[]
  timelineIndex?: number
}

export function isSavedFeedsPref<V>(v: V) {
  return is$typed(v, id, 'savedFeedsPref')
}

export function validateSavedFeedsPref(v: unknown) {
  return lexicons.validate(
    `${id}#savedFeedsPref`,
    v,
  ) as ValidationResult<SavedFeedsPref>
}

export function isValidSavedFeedsPref<V>(
  v: V,
): v is V & $Typed<SavedFeedsPref> {
  return isSavedFeedsPref(v) && validateSavedFeedsPref(v).success
}

export interface PersonalDetailsPref {
  $type?: $Type<'app.bsky.actor.defs', 'personalDetailsPref'>
  /** The birth date of account owner. */
  birthDate?: string
}

export function isPersonalDetailsPref<V>(v: V) {
  return is$typed(v, id, 'personalDetailsPref')
}

export function validatePersonalDetailsPref(v: unknown) {
  return lexicons.validate(
    `${id}#personalDetailsPref`,
    v,
  ) as ValidationResult<PersonalDetailsPref>
}

export function isValidPersonalDetailsPref<V>(
  v: V,
): v is V & $Typed<PersonalDetailsPref> {
  return isPersonalDetailsPref(v) && validatePersonalDetailsPref(v).success
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

export function isFeedViewPref<V>(v: V) {
  return is$typed(v, id, 'feedViewPref')
}

export function validateFeedViewPref(v: unknown) {
  return lexicons.validate(
    `${id}#feedViewPref`,
    v,
  ) as ValidationResult<FeedViewPref>
}

export function isValidFeedViewPref<V>(v: V): v is V & $Typed<FeedViewPref> {
  return isFeedViewPref(v) && validateFeedViewPref(v).success
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

export function isThreadViewPref<V>(v: V) {
  return is$typed(v, id, 'threadViewPref')
}

export function validateThreadViewPref(v: unknown) {
  return lexicons.validate(
    `${id}#threadViewPref`,
    v,
  ) as ValidationResult<ThreadViewPref>
}

export function isValidThreadViewPref<V>(
  v: V,
): v is V & $Typed<ThreadViewPref> {
  return isThreadViewPref(v) && validateThreadViewPref(v).success
}

export interface InterestsPref {
  $type?: $Type<'app.bsky.actor.defs', 'interestsPref'>
  /** A list of tags which describe the account owner's interests gathered during onboarding. */
  tags: string[]
}

export function isInterestsPref<V>(v: V) {
  return is$typed(v, id, 'interestsPref')
}

export function validateInterestsPref(v: unknown) {
  return lexicons.validate(
    `${id}#interestsPref`,
    v,
  ) as ValidationResult<InterestsPref>
}

export function isValidInterestsPref<V>(v: V): v is V & $Typed<InterestsPref> {
  return isInterestsPref(v) && validateInterestsPref(v).success
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

export function isMutedWord<V>(v: V) {
  return is$typed(v, id, 'mutedWord')
}

export function validateMutedWord(v: unknown) {
  return lexicons.validate(`${id}#mutedWord`, v) as ValidationResult<MutedWord>
}

export function isValidMutedWord<V>(v: V): v is V & $Typed<MutedWord> {
  return isMutedWord(v) && validateMutedWord(v).success
}

export interface MutedWordsPref {
  $type?: $Type<'app.bsky.actor.defs', 'mutedWordsPref'>
  /** A list of words the account owner has muted. */
  items: MutedWord[]
}

export function isMutedWordsPref<V>(v: V) {
  return is$typed(v, id, 'mutedWordsPref')
}

export function validateMutedWordsPref(v: unknown) {
  return lexicons.validate(
    `${id}#mutedWordsPref`,
    v,
  ) as ValidationResult<MutedWordsPref>
}

export function isValidMutedWordsPref<V>(
  v: V,
): v is V & $Typed<MutedWordsPref> {
  return isMutedWordsPref(v) && validateMutedWordsPref(v).success
}

export interface HiddenPostsPref {
  $type?: $Type<'app.bsky.actor.defs', 'hiddenPostsPref'>
  /** A list of URIs of posts the account owner has hidden. */
  items: string[]
}

export function isHiddenPostsPref<V>(v: V) {
  return is$typed(v, id, 'hiddenPostsPref')
}

export function validateHiddenPostsPref(v: unknown) {
  return lexicons.validate(
    `${id}#hiddenPostsPref`,
    v,
  ) as ValidationResult<HiddenPostsPref>
}

export function isValidHiddenPostsPref<V>(
  v: V,
): v is V & $Typed<HiddenPostsPref> {
  return isHiddenPostsPref(v) && validateHiddenPostsPref(v).success
}

export interface LabelersPref {
  $type?: $Type<'app.bsky.actor.defs', 'labelersPref'>
  labelers: LabelerPrefItem[]
}

export function isLabelersPref<V>(v: V) {
  return is$typed(v, id, 'labelersPref')
}

export function validateLabelersPref(v: unknown) {
  return lexicons.validate(
    `${id}#labelersPref`,
    v,
  ) as ValidationResult<LabelersPref>
}

export function isValidLabelersPref<V>(v: V): v is V & $Typed<LabelersPref> {
  return isLabelersPref(v) && validateLabelersPref(v).success
}

export interface LabelerPrefItem {
  $type?: $Type<'app.bsky.actor.defs', 'labelerPrefItem'>
  did: string
}

export function isLabelerPrefItem<V>(v: V) {
  return is$typed(v, id, 'labelerPrefItem')
}

export function validateLabelerPrefItem(v: unknown) {
  return lexicons.validate(
    `${id}#labelerPrefItem`,
    v,
  ) as ValidationResult<LabelerPrefItem>
}

export function isValidLabelerPrefItem<V>(
  v: V,
): v is V & $Typed<LabelerPrefItem> {
  return isLabelerPrefItem(v) && validateLabelerPrefItem(v).success
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

export function isBskyAppStatePref<V>(v: V) {
  return is$typed(v, id, 'bskyAppStatePref')
}

export function validateBskyAppStatePref(v: unknown) {
  return lexicons.validate(
    `${id}#bskyAppStatePref`,
    v,
  ) as ValidationResult<BskyAppStatePref>
}

export function isValidBskyAppStatePref<V>(
  v: V,
): v is V & $Typed<BskyAppStatePref> {
  return isBskyAppStatePref(v) && validateBskyAppStatePref(v).success
}

/** If set, an active progress guide. Once completed, can be set to undefined. Should have unspecced fields tracking progress. */
export interface BskyAppProgressGuide {
  $type?: $Type<'app.bsky.actor.defs', 'bskyAppProgressGuide'>
  guide: string
}

export function isBskyAppProgressGuide<V>(v: V) {
  return is$typed(v, id, 'bskyAppProgressGuide')
}

export function validateBskyAppProgressGuide(v: unknown) {
  return lexicons.validate(
    `${id}#bskyAppProgressGuide`,
    v,
  ) as ValidationResult<BskyAppProgressGuide>
}

export function isValidBskyAppProgressGuide<V>(
  v: V,
): v is V & $Typed<BskyAppProgressGuide> {
  return isBskyAppProgressGuide(v) && validateBskyAppProgressGuide(v).success
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

export function isNux<V>(v: V) {
  return is$typed(v, id, 'nux')
}

export function validateNux(v: unknown) {
  return lexicons.validate(`${id}#nux`, v) as ValidationResult<Nux>
}

export function isValidNux<V>(v: V): v is V & $Typed<Nux> {
  return isNux(v) && validateNux(v).success
}
