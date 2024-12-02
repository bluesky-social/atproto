/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ToolsOzoneSetDefs from './defs'

export const id = 'tools.ozone.set.querySets'

export interface QueryParams {
  limit?: number
  cursor?: string
  namePrefix?: string
  sortBy?: 'name' | 'createdAt' | 'updatedAt'
  /** Defaults to ascending order of name field. */
  sortDirection?: 'asc' | 'desc'
}

export type InputSchema = undefined

export interface OutputSchema {
  sets: ToolsOzoneSetDefs.SetView[]
  cursor?: string
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
