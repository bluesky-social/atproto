/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import { $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import type * as ToolsOzoneSetDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.set.upsertSet'

export interface QueryParams {}

export type InputSchema = ToolsOzoneSetDefs.Set
export type OutputSchema = ToolsOzoneSetDefs.SetView

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

export function toKnownErr(e: any) {
  return e
}
