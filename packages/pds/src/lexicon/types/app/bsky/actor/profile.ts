/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface Record {
  displayName: string
  description?: string
  avatar?: { cid: string; mimeType: string; [k: string]: unknown }
  banner?: { cid: string; mimeType: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.actor.profile#main' ||
      v.$type === 'app.bsky.actor.profile')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.profile#main', v)
}

export interface View {
  did: string
  declaration: AppBskySystemDeclRef.Main
  handle: string
  displayName?: string
  description?: string
  avatar?: string
  banner?: string
  followersCount: number
  followsCount: number
  postsCount: number
  creator: string
  indexedAt?: string
  viewer?: ViewerState
  myState?: MyState
  [k: string]: unknown
}

export function isView(v: unknown): v is View {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.actor.profile#view'
  )
}

export function validateView(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.profile#view', v)
}

export interface ViewBasic {
  did: string
  declaration: AppBskySystemDeclRef.Main
  handle: string
  displayName?: string
  description?: string
  avatar?: string
  indexedAt?: string
  viewer?: ViewerState
  [k: string]: unknown
}

export function isViewBasic(v: unknown): v is ViewBasic {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.profile#viewBasic'
  )
}

export function validateViewBasic(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.profile#viewBasic', v)
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
    v.$type === 'app.bsky.actor.profile#viewerState'
  )
}

export function validateViewerState(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.profile#viewerState', v)
}

/** Deprecated in favor of #viewerState */
export interface MyState {
  follow?: string
  muted?: boolean
  [k: string]: unknown
}

export function isMyState(v: unknown): v is MyState {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.actor.profile#myState'
  )
}

export function validateMyState(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.profile#myState', v)
}
