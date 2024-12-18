/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as AppBskyActorDefs from '../actor/defs'

export interface QueryParams {
  /** AT-URI of the subject (eg, a post record). */
  uri: string
  /** CID of the subject record (aka, specific version of record), to filter likes. */
  cid?: string
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  uri: string
  cid?: string
  cursor?: string
  pollAnswers?: PollAnswer[]
  [k: string]: unknown
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

export interface PollAnswer {
  indexedAt: string
  createdAt: string
  actor: AppBskyActorDefs.ProfileView
  answer: number
  [k: string]: unknown
}

export function isPollAnswer(v: unknown): v is PollAnswer {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.getPollAnswers#pollAnswer'
  )
}

export function validatePollAnswer(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.getPollAnswers#pollAnswer', v)
}
