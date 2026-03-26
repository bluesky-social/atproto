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
import type * as ToolsOzoneQueueDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.queue.getLiveStats'

export type QueryParams = {
  /** Filter stats by queue. Cannot filter by both queue and moderator. */
  queueId?: number
  /** Filter stats by moderator. Cannot filter by both queue and moderator. */
  moderatorDid?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  stats: ToolsOzoneQueueDefs.QueueStats
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
