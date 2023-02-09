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
  creator: string
  displayName?: string
  description?: string
  avatar?: string
  banner?: string
  followersCount: number
  followsCount: number
  postsCount: number
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
