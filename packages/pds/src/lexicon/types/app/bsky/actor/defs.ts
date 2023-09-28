/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import * as AppBskyGraphDefs from '../graph/defs'

export interface ProfileViewBasic {
  did: string
  handle: string
  displayName?: string
  avatar?: string
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

export interface ViewerState {
  muted?: boolean
  mutedByList?: AppBskyGraphDefs.ListViewBasic
  blockedBy?: boolean
  blocking?: string
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
  | PersonalDetailsPref
  | FeedViewPref
  | ThreadViewPref
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
  label: string
  visibility: 'show' | 'warn' | 'hide' | (string & {})
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

export interface SavedFeedsPref {
  pinned: string[]
  saved: string[]
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
  /** The birth date of the owner of the account. */
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
  hideRepliesByUnfollowed?: boolean
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
  /** Sorting mode. */
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
