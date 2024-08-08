/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as AppBskyUnspeccedDefs from './defs'

export interface QueryParams {
  /** Search query string; syntax, phrase, boolean, and faceting is unspecified, but Lucene query syntax is recommended. */
  q: string
  /** Specifies the ranking order of results. */
  sort?: 'top' | 'latest' | (string & {})
  /** Filter results for posts after the indicated datetime (inclusive). Expected to use 'sortAt' timestamp, which may not match 'createdAt'. Can be a datetime, or just an ISO date (YYYY-MM-DD). */
  since?: string
  /** Filter results for posts before the indicated datetime (not inclusive). Expected to use 'sortAt' timestamp, which may not match 'createdAt'. Can be a datetime, or just an ISO date (YYY-MM-DD). */
  until?: string
  /** Filter to posts which mention the given account. Handles are resolved to DID before query-time. Only matches rich-text facet mentions. */
  mentions?: string
  /** Filter to posts by the given account. Handles are resolved to DID before query-time. */
  author?: string
  /** Filter to posts in the given language. Expected to be based on post language field, though server may override language detection. */
  lang?: string
  /** Filter to posts with URLs (facet links or embeds) linking to the given domain (hostname). Server may apply hostname normalization. */
  domain?: string
  /** Filter to posts with links (facet links or embeds) pointing to this URL. Server may apply URL normalization or fuzzy matching. */
  url?: string
  /** Filter to posts with the given tag (hashtag), based on rich-text facet or tag field. Do not include the hash (#) prefix. Multiple tags can be specified, with 'AND' matching. */
  tag?: string[]
  /** DID of the account making the request (not included for public/unauthenticated queries). Used for 'from:me' queries. */
  viewer?: string
  limit?: number
  /** Optional pagination mechanism; may not necessarily allow scrolling through entire result set. */
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  /** Count of search hits. Optional, may be rounded/truncated, and may not be possible to paginate through all hits. */
  hitsTotal?: number
  posts: AppBskyUnspeccedDefs.SkeletonSearchPost[]
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

export class BadQueryStringError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'BadQueryString') return new BadQueryStringError(e)
  }

  return e
}
