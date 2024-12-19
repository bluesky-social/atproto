/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyFeedDefs from '../feed/defs'

const id = 'app.bsky.unspecced.getPopularFeedGenerators'

export interface QueryParams {
  limit?: number
  cursor?: string
  query?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  feeds: AppBskyFeedDefs.GeneratorView[]
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
