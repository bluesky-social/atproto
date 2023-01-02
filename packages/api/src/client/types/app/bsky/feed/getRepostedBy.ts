/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskySystemDeclRef from '../system/declRef'

export interface QueryParams {
  uri: string
  cid?: string
  limit?: number
  before?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  uri: string
  cid?: string
  cursor?: string
  repostedBy: RepostedBy[]
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

export interface RepostedBy {
  did: string
  declaration: AppBskySystemDeclRef.Main
  handle: string
  displayName?: string
  avatar?: string
  createdAt?: string
  indexedAt: string
  [k: string]: unknown
}

export function isRepostedBy(v: unknown): v is RepostedBy {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.getRepostedBy#repostedBy'
  )
}

export function validateRepostedBy(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.getRepostedBy#repostedBy', v)
}
