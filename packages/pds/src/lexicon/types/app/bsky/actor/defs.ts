/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'

export interface WithInfo {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  viewer?: ViewerState
  [k: string]: unknown
}

export function isWithInfo(v: unknown): v is WithInfo {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.defs#withInfo'
  )
}

export function validateWithInfo(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.defs#withInfo', v)
}

export interface ViewerState {
  muted?: boolean
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
