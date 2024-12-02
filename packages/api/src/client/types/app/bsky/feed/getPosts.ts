/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyFeedDefs from './defs'

export const id = 'app.bsky.feed.getPosts'

export interface QueryParams {
  /** List of post AT-URIs to return hydrated views for. */
  uris: string[]
}

export type InputSchema = undefined

export interface OutputSchema {
  posts: AppBskyFeedDefs.PostView[]
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
