/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyActorRef from '../actor/ref'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  actor: string
  limit?: number
  before?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  subject: AppBskyActorRef.WithInfo
  cursor?: string
  members: Member[]
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

export interface Member {
  did: string
  declaration: AppBskySystemDeclRef.Main
  handle: string
  displayName?: string
  createdAt?: string
  indexedAt: string
  [k: string]: unknown
}

export function isMember(v: unknown): v is Member {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.getMembers#member'
  )
}

export function validateMember(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.getMembers#member', v)
}
