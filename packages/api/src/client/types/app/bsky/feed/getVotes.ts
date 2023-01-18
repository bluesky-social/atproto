/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyActorRef from '../actor/ref'

export interface QueryParams {
  uri: string
  cid?: string
  direction?: 'up' | 'down'
  limit?: number
  before?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  uri: string
  cid?: string
  cursor?: string
  votes: Vote[]
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

export interface Vote {
  direction: 'up' | 'down'
  indexedAt: string
  createdAt: string
  actor: AppBskyActorRef.WithInfo
  [k: string]: unknown
}

export function isVote(v: unknown): v is Vote {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.feed.getVotes#vote'
  )
}

export function validateVote(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.getVotes#vote', v)
}
