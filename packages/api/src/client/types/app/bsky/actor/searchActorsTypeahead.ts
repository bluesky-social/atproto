/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as AppBskyActorDefs from './defs'

export interface QueryParams {
  /** DEPRECATED: use 'q' instead. */
  term?: string
  /** Search query prefix; not a full query string. */
  q?: string
  limit?: number
}

export type InputSchema = undefined

export interface OutputSchema {
  actors: AppBskyActorDefs.ProfileViewBasic[]
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
