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
import type * as AppBskyDraftDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.draft.createDraft'

export type QueryParams = {}

export interface InputSchema {
  draft: AppBskyDraftDefs.Draft
}

export interface OutputSchema {
  /** The ID of the created draft. */
  id: string
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
  encoding?: 'application/json'
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export class DraftLimitReachedError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'DraftLimitReached') return new DraftLimitReachedError(e)
  }

  return e
}
