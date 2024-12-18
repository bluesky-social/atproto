/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ToolsOzoneSetDefs from './defs'

const id = 'tools.ozone.set.getValues'

export interface QueryParams {
  name: string
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  set: ToolsOzoneSetDefs.SetView
  values: string[]
  cursor?: string
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

export class SetNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'SetNotFound') return new SetNotFoundError(e)
  }

  return e
}
