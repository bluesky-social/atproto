/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyLabelerDefs from './defs'

const id = 'app.bsky.labeler.getServices'

export interface QueryParams {
  dids: string[]
  detailed?: boolean
}

export type InputSchema = undefined

export interface OutputSchema {
  views: (
    | AppBskyLabelerDefs.LabelerView
    | AppBskyLabelerDefs.LabelerViewDetailed
    | { $type: string; [k: string]: unknown }
  )[]
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

export function toKnownErr(e: any) {
  return e
}
