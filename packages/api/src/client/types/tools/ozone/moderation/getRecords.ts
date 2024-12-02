/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ToolsOzoneModerationDefs from './defs'

export const id = 'tools.ozone.moderation.getRecords'

export interface QueryParams {
  uris: string[]
}

export type InputSchema = undefined

export interface OutputSchema {
  records: (
    | $Typed<ToolsOzoneModerationDefs.RecordViewDetail>
    | $Typed<ToolsOzoneModerationDefs.RecordViewNotFound>
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

export function toKnownErr(e: any) {
  return e
}
