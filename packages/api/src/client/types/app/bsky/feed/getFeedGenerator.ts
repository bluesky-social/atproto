/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import type * as AppBskyFeedDefs from './defs'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'app.bsky.feed.getFeedGenerator'

export interface QueryParams {
  /** AT-URI of the feed generator record. */
  feed: string
}

export type InputSchema = undefined

export interface OutputSchema {
  view: AppBskyFeedDefs.GeneratorView
  /** Indicates whether the feed generator service has been online recently, or else seems to be inactive. */
  isOnline: boolean
  /** Indicates whether the feed generator service is compatible with the record declaration. */
  isValid: boolean
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
