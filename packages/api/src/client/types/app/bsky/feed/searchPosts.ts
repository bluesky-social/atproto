/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as AppBskyFeedDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.feed.searchPosts'

export type QueryParams = {
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
  limit?: number
  /** Optional pagination mechanism; may not necessarily allow scrolling through entire result set. */
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  /** Count of search hits. Optional, may be rounded/truncated, and may not be possible to paginate through all hits. */
  hitsTotal?: number
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
