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
import type * as AppBskyGraphDefs from './defs'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'app.bsky.graph.getRelationships'

export interface QueryParams {
  /** Primary account requesting relationships for. */
  actor: string
  /** List of 'other' accounts to be related back to the primary. */
  others?: string[]
}

export type InputSchema = undefined

export interface OutputSchema {
  actor?: string
  relationships: (
    | $Typed<AppBskyGraphDefs.Relationship>
    | $Typed<AppBskyGraphDefs.NotFoundActor>
    | { $type: string }
  )[]
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

export class ActorNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'ActorNotFound') return new ActorNotFoundError(e)
  }

  return e
}
