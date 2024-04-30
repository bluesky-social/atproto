/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import * as AppBskyGraphDefs from '../graph/defs'

export interface ProfileViewBasic {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  associated?: ProfileAssociated
  viewer?: ViewerState
  labels?: ComAtprotoLabelDefs.Label[]
  [k: string]: unknown
}

export function isProfileViewBasic(v: unknown): v is ProfileViewBasic {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#profileViewBasic'
  )
}

export function validateProfileViewBasic(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#profileViewBasic', v)
}

export interface ProfileView {
  did: string
  handle: string
  displayName?: string
  description?: string
  avatar?: string
  associated?: ProfileAssociated
  indexedAt?: string
  viewer?: ViewerState
  labels?: ComAtprotoLabelDefs.Label[]
  [k: string]: unknown
}

export function isProfileView(v: unknown): v is ProfileView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#profileView'
  )
}

export function validateProfileView(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#profileView', v)
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
  indexedAt?: string
  viewer?: ViewerState
  labels?: ComAtprotoLabelDefs.Label[]
  [k: string]: unknown
}

export function isProfileViewDetailed(v: unknown): v is ProfileViewDetailed {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#profileViewDetailed'
  )
}

export function validateProfileViewDetailed(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#profileViewDetailed', v)
}

export interface ProfileAssociated {
  lists?: number
  feedgens?: number
  labeler?: boolean
  [k: string]: unknown
}

export function isProfileAssociated(v: unknown): v is ProfileAssociated {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#profileAssociated'
  )
}

export function validateProfileAssociated(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#profileAssociated', v)
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
  [k: string]: unknown
}

export function isViewerState(v: unknown): v is ViewerState {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#viewerState'
  )
}

export function validateViewerState(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#viewerState', v)
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
  | { $type: string; [k: string]: unknown }
)[]

export interface AdultContentPref {
  enabled: boolean
  [k: string]: unknown
}

export function isAdultContentPref(v: unknown): v is AdultContentPref {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#adultContentPref'
  )
}

export function validateAdultContentPref(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#adultContentPref', v)
}

export interface ContentLabelPref {
  /** Which labeler does this preference apply to? If undefined, applies globally. */
  labelerDid?: string
  label: string
  visibility: 'ignore' | 'show' | 'warn' | 'hide' | (string & {})
  [k: string]: unknown
}

export function isContentLabelPref(v: unknown): v is ContentLabelPref {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#contentLabelPref'
  )
}

export function validateContentLabelPref(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#contentLabelPref', v)
}

export interface SavedFeed {
  id: string
  type: 'feed' | 'list' | 'timeline' | (string & {})
  value: string
  pinned: boolean
  [k: string]: unknown
}

export function isSavedFeed(v: unknown): v is SavedFeed {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#savedFeed'
  )
}

export function validateSavedFeed(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#savedFeed', v)
}

export interface SavedFeedsPrefV2 {
  items: SavedFeed[]
  [k: string]: unknown
}

export function isSavedFeedsPrefV2(v: unknown): v is SavedFeedsPrefV2 {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#savedFeedsPrefV2'
  )
}

export function validateSavedFeedsPrefV2(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#savedFeedsPrefV2', v)
}

export interface SavedFeedsPref {
  pinned: string[]
  saved: string[]
  timelineIndex?: number
  [k: string]: unknown
}

export function isSavedFeedsPref(v: unknown): v is SavedFeedsPref {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#savedFeedsPref'
  )
}

export function validateSavedFeedsPref(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#savedFeedsPref', v)
}

export interface PersonalDetailsPref {
  /** The birth date of account owner. */
  birthDate?: string
  [k: string]: unknown
}

export function isPersonalDetailsPref(v: unknown): v is PersonalDetailsPref {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#personalDetailsPref'
  )
}

export function validatePersonalDetailsPref(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#personalDetailsPref', v)
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

export function isFeedViewPref(v: unknown): v is FeedViewPref {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#feedViewPref'
  )
}

export function validateFeedViewPref(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#feedViewPref', v)
}

export interface ThreadViewPref {
  /** Sorting mode for threads. */
  sort?: 'oldest' | 'newest' | 'most-likes' | 'random' | (string & {})
  /** Show followed users at the top of all replies. */
  prioritizeFollowedUsers?: boolean
  [k: string]: unknown
}

export function isThreadViewPref(v: unknown): v is ThreadViewPref {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#threadViewPref'
  )
}

export function validateThreadViewPref(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#threadViewPref', v)
}

export interface InterestsPref {
  /** A list of tags which describe the account owner's interests gathered during onboarding. */
  tags: string[]
  [k: string]: unknown
}

export function isInterestsPref(v: unknown): v is InterestsPref {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#interestsPref'
  )
}

export function validateInterestsPref(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#interestsPref', v)
}

export type MutedWordTarget = 'content' | 'tag' | (string & {})

/** A word that the account owner has muted. */
export interface MutedWord {
  /** The muted word itself. */
  value: string
  /** The intended targets of the muted word. */
  targets: MutedWordTarget[]
  [k: string]: unknown
}

export function isMutedWord(v: unknown): v is MutedWord {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#mutedWord'
  )
}

export function validateMutedWord(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#mutedWord', v)
}

export interface MutedWordsPref {
  /** A list of words the account owner has muted. */
  items: MutedWord[]
  [k: string]: unknown
}

export function isMutedWordsPref(v: unknown): v is MutedWordsPref {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#mutedWordsPref'
  )
}

export function validateMutedWordsPref(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#mutedWordsPref', v)
}

export interface HiddenPostsPref {
  /** A list of URIs of posts the account owner has hidden. */
  items: string[]
  [k: string]: unknown
}

export function isHiddenPostsPref(v: unknown): v is HiddenPostsPref {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#hiddenPostsPref'
  )
}

export function validateHiddenPostsPref(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#hiddenPostsPref', v)
}

export interface LabelersPref {
  labelers: LabelerPrefItem[]
  [k: string]: unknown
}

export function isLabelersPref(v: unknown): v is LabelersPref {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#labelersPref'
  )
}

export function validateLabelersPref(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#labelersPref', v)
}

export interface LabelerPrefItem {
  did: string
  [k: string]: unknown
}

export function isLabelerPrefItem(v: unknown): v is LabelerPrefItem {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#labelerPrefItem'
  )
}

export function validateLabelerPrefItem(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#labelerPrefItem', v)
}
