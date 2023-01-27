/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  actor: string
}

export type InputSchema = undefined

export interface OutputSchema {
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

export interface CallOptions {
  headers?: Headers
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
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
    v.$type === 'app.bsky.actor.getProfile#myState'
  )
}

export function validateMyState(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.actor.getProfile#myState', v)
}
