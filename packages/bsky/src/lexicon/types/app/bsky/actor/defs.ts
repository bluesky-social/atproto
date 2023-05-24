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
