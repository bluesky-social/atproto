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
const id = 'tools.ozone.queue.listQueues'

export type QueryParams = {
  /** Filter by enabled status. If not specified, returns all queues. */
  enabled?: boolean
  /** Filter queues that handle this subject type ('account' or 'record'). */
  subjectType?: string
  /** Filter queues by collection name (e.g. 'app.bsky.feed.post'). */
  collection?: string
  /** Filter queues that handle any of these report reason types. */
  reportTypes?: string[]
  limit?: number
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  queues: ToolsOzoneQueueDefs.QueueView[]
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
